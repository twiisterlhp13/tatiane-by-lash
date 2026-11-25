"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  BookingError,
  changeStatus,
  getAppointmentByToken,
  getOrgBySlug,
  orgSettings,
  rescheduleAppointment,
  rotateManageToken,
} from "@/lib/booking";
import { canClientChange } from "@/lib/availability";
import { notifyAppointment } from "@/lib/notify";
import { normalizePhone } from "@/lib/security";

export type Result = { ok: true } | { ok: false; error: string };

async function load(slug: string, code: string, token: string) {
  const org = await getOrgBySlug(slug);
  if (!org) throw new BookingError("not_found", "Agendamento não encontrado.");
  const row = await getAppointmentByToken(org.id, code, token);
  if (!row) throw new BookingError("not_found", "Link inválido. Use o link mais recente que você recebeu.");
  return { org, ...row };
}

export async function clientCancelAction(input: { slug: string; code: string; token: string; reason: string }): Promise<Result> {
  try {
    const { org, appt, client } = await load(input.slug, input.code, input.token);
    const s = orgSettings(org);
    if (appt.status !== "pending" && appt.status !== "confirmed") return { ok: false, error: "Este agendamento não está mais ativo." };
    if (!canClientChange(appt.startsAt, new Date(), s.cancelUntilHours)) {
      return { ok: false, error: "O prazo para cancelar pelo site já passou. Fale com a gente pelo WhatsApp." };
    }
    if (s.requireCancelReason && input.reason.trim().length < 3) return { ok: false, error: "Conte rapidinho o motivo do cancelamento." };
    await changeStatus({
      orgId: org.id, appointmentId: appt.id, status: "cancelled_by_client", reason: input.reason.trim().slice(0, 500),
      actor: { type: "client", label: client.name, source: "online" },
    });
    after(async () => {
      await notifyAppointment({ appointmentId: appt.id, key: "booking_cancelled_client" });
      await notifyAppointment({ appointmentId: appt.id, key: "booking_cancelled_business" });
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Não foi possível cancelar agora." };
  }
}

export async function clientRescheduleAction(input: { slug: string; code: string; token: string; startsAt: string }): Promise<Result> {
  try {
    const { org, appt, client } = await load(input.slug, input.code, input.token);
    const s = orgSettings(org);
    if (appt.status !== "pending" && appt.status !== "confirmed") return { ok: false, error: "Este agendamento não está mais ativo." };
    if (!canClientChange(appt.startsAt, new Date(), s.rescheduleUntilHours)) {
      return { ok: false, error: "O prazo para reagendar pelo site já passou. Fale com a gente pelo WhatsApp." };
    }
    const startsAt = new Date(input.startsAt);
    if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "Horário inválido." };
    await rescheduleAppointment({
      orgId: org.id, appointmentId: appt.id, startsAt, mode: "client",
      actor: { type: "client", label: client.name, source: "online" },
    });
    after(async () => {
      await notifyAppointment({ appointmentId: appt.id, key: "booking_rescheduled_client", manageToken: input.token });
      await notifyAppointment({ appointmentId: appt.id, key: "booking_new_business", extra: { codigo: `${appt.code} (reagendado pela cliente)` } });
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Não foi possível reagendar agora." };
  }
}

export type LookupState = { error?: string } | undefined;

/** Encontra um agendamento pelo código + telefone e gera um novo link de gestão. */
export async function lookupAction(slug: string, _: LookupState, form: FormData): Promise<LookupState> {
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  const org = await getOrgBySlug(slug);
  if (!org || code.length < 4 || phone.length < 10) return { error: "Confira o código e o telefone." };
  const [row] = await db.select({ id: schema.appointments.id, phone: schema.clients.phoneNormalized })
    .from(schema.appointments).innerJoin(schema.clients, eq(schema.clients.id, schema.appointments.clientId))
    .where(and(eq(schema.appointments.organizationId, org.id), eq(schema.appointments.code, code))).limit(1);
  await new Promise((r) => setTimeout(r, 400)); // reduz tentativas automáticas
  if (!row || row.phone !== phone) return { error: "Não encontramos um agendamento com esses dados." };
  const token = await rotateManageToken(row.id);
  redirect(`/${org.slug}/agendamento/${code}?t=${token}`);
}
