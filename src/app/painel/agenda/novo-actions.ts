"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { clientIp, requireCtx } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { BookingError, createPanelAppointment, upsertClient } from "@/lib/booking";
import { notifyAppointment } from "@/lib/notify";
import { isValidBrPhone } from "@/lib/security";
import { hhmmToMinutes, isValidLocalDate, localToUtc } from "@/lib/time";

const schemaNovo = z.object({
  clientId: z.string().optional(),
  clientName: z.string().trim().max(120),
  phone: z.string().trim().max(30).default(""),
  serviceId: z.uuid("Escolha o procedimento."),
  professionalId: z.uuid("Escolha a profissional."),
  date: z.string().refine(isValidLocalDate, "Escolha o dia."),
  time: z.string().refine((t) => hhmmToMinutes(t) !== null, "Escolha o horário."),
  priceCents: z.number().int().min(0).max(10_000_000),
  notes: z.string().max(2000).default(""),
});

export type NovoResult = { ok: true } | { ok: false; error: string };

/** Agendamento rápido pelo painel (o WhatsApp da cliente é opcional, como no atendimento de balcão). */
export async function novoAgendamentoAction(input: z.input<typeof schemaNovo>): Promise<NovoResult> {
  const ctx = await requireCtx();
  const parsed = schemaNovo.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  try {
    if (!ctx.can("agenda.manage_all") && d.professionalId !== ctx.professionalId) {
      return { ok: false, error: "Você só pode agendar na sua própria agenda." };
    }
    let clientId: string | null = null;
    if (d.clientId) {
      const [c] = await db.select({ id: schema.clients.id }).from(schema.clients)
        .where(and(eq(schema.clients.id, d.clientId), eq(schema.clients.organizationId, ctx.org.id))).limit(1);
      clientId = c?.id ?? null;
    }
    if (!clientId) {
      if (d.clientName.length < 2) return { ok: false, error: "Informe o nome da cliente." };
      if (d.phone && !isValidBrPhone(d.phone)) return { ok: false, error: "WhatsApp inválido. Use DDD + número." };
      if (d.phone) {
        clientId = (await upsertClient(db, ctx.org.id, { name: d.clientName, phone: d.phone })).id;
      } else {
        const [same] = await db.select({ id: schema.clients.id }).from(schema.clients)
          .where(and(eq(schema.clients.organizationId, ctx.org.id), isNull(schema.clients.anonymizedAt), sql`lower(${schema.clients.name}) = lower(${d.clientName})`))
          .limit(1);
        clientId = same?.id ?? (await db.insert(schema.clients).values({ organizationId: ctx.org.id, name: d.clientName }).returning())[0].id;
      }
    }
    const startsAt = localToUtc(d.date, hhmmToMinutes(d.time)!, ctx.org.timezone);
    const { appointment, manageToken } = await createPanelAppointment({
      orgId: ctx.org.id,
      tz: ctx.org.timezone,
      clientId,
      serviceId: d.serviceId,
      professionalId: d.professionalId,
      startsAt,
      priceCents: d.priceCents,
      internalNotes: d.notes,
      status: "confirmed",
      allowOutsideHours: true,
      actor: { type: "user", userId: ctx.user.id, label: ctx.user.name, source: "panel" },
    });
    await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "appointment.created", entity: "appointment", entityId: appointment.id, ip: await clientIp() });
    after(() => notifyAppointment({ appointmentId: appointment.id, key: "booking_confirmed_client", manageToken }));
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Não foi possível salvar. Tente novamente." };
  }
}
