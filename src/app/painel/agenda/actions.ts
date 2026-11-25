"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { clientIp, requireCtx, type Ctx } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  BookingError,
  changeStatus,
  createPanelAppointment,
  findBlockConflicts,
  rescheduleAppointment,
  rotateManageToken,
  upsertClient,
} from "@/lib/booking";
import { notifyAppointment } from "@/lib/notify";
import { addDays, hhmmToMinutes, isValidLocalDate, localToUtc } from "@/lib/time";
import { formatPhone, isValidBrPhone } from "@/lib/security";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string; code?: string; conflicts?: ConflictInfo[] };
export type ConflictInfo = { id: string; client: string; service: string; professional: string; startsAt: string };

function actor(ctx: Ctx) {
  return { type: "user" as const, userId: ctx.user.id, label: ctx.user.name, source: "panel" as const };
}

/** Garante que a usuária pode mexer na agenda deste profissional. */
function assertCanManage(ctx: Ctx, professionalId: string | null) {
  if (ctx.can("agenda.manage_all")) return;
  if (ctx.can("agenda.manage_own") && professionalId && professionalId === ctx.professionalId) return;
  throw new BookingError("forbidden", "Você só pode alterar a sua própria agenda.");
}

async function loadAppointment(ctx: Ctx, id: string) {
  const [a] = await db.select().from(schema.appointments)
    .where(and(eq(schema.appointments.id, id), eq(schema.appointments.organizationId, ctx.org.id))).limit(1);
  if (!a) throw new BookingError("not_found", "Agendamento não encontrado.");
  assertCanManage(ctx, a.professionalId);
  return a;
}

function fail(e: unknown): ActionResult {
  if (e instanceof BookingError) return { ok: false, error: e.message, code: e.code };
  console.error(e);
  return { ok: false, error: "Algo deu errado. Tente novamente." };
}

/* ------------------------------ Clientes ------------------------------ */

export async function searchClientsAction(q: string) {
  const ctx = await requireCtx();
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  const rows = await db.select({ id: schema.clients.id, name: schema.clients.name, phone: schema.clients.phone })
    .from(schema.clients)
    .where(and(
      eq(schema.clients.organizationId, ctx.org.id),
      isNull(schema.clients.anonymizedAt),
      or(ilike(schema.clients.name, `%${term}%`), digits.length >= 4 ? ilike(schema.clients.phoneNormalized, `%${digits}%`) : undefined),
    ))
    .limit(8);
  return rows.map((r) => ({ ...r, phone: formatPhone(r.phone) }));
}

const newClientSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da cliente."),
  phone: z.string().trim().refine(isValidBrPhone, "Telefone inválido. Use DDD + número."),
  email: z.union([z.email("E-mail inválido."), z.literal("")]).default(""),
});

export async function createClientInlineAction(input: z.input<typeof newClientSchema>): Promise<ActionResult<{ id: string; name: string; phone: string }>> {
  try {
    const ctx = await requireCtx();
    if (!ctx.can("clients.manage") && !ctx.can("agenda.manage_own")) throw new BookingError("forbidden", "Sem permissão.");
    const parsed = newClientSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const c = await upsertClient(db, ctx.org.id, { name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email });
    await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "client.created", entity: "client", entityId: c.id });
    return { ok: true, data: { id: c.id, name: c.name, phone: formatPhone(c.phone) } };
  } catch (e) {
    return fail(e) as ActionResult<never>;
  }
}

/* ---------------------------- Agendamentos ---------------------------- */

const createSchema = z.object({
  clientId: z.uuid("Escolha a cliente."),
  serviceId: z.uuid("Escolha o serviço."),
  professionalId: z.uuid("Escolha o profissional."),
  date: z.string().refine(isValidLocalDate, "Data inválida."),
  time: z.string().refine((t) => hhmmToMinutes(t) !== null, "Horário inválido."),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
  notes: z.string().max(2000).default(""),
  priceCents: z.number().int().min(0).optional(),
  allowOutsideHours: z.boolean().default(false),
  notifyClient: z.boolean().default(true),
});

export async function createAppointmentAction(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireCtx();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const d = parsed.data;
    assertCanManage(ctx, d.professionalId);
    const startsAt = localToUtc(d.date, hhmmToMinutes(d.time)!, ctx.org.timezone);
    const { appointment, manageToken } = await createPanelAppointment({
      orgId: ctx.org.id, tz: ctx.org.timezone, clientId: d.clientId, serviceId: d.serviceId, professionalId: d.professionalId,
      startsAt, status: d.status, internalNotes: d.notes, priceCents: d.priceCents, allowOutsideHours: d.allowOutsideHours, actor: actor(ctx),
    });
    await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "appointment.created", entity: "appointment", entityId: appointment.id, ip: await clientIp() });
    if (d.notifyClient) {
      after(() => notifyAppointment({ appointmentId: appointment.id, key: d.status === "confirmed" ? "booking_confirmed_client" : "booking_pending_client", manageToken }));
    }
    revalidatePath("/painel");
    return { ok: true, data: { id: appointment.id } };
  } catch (e) {
    return fail(e) as ActionResult<never>;
  }
}

export async function rescheduleAction(input: { id: string; date: string; time: string; professionalId?: string; allowOutsideHours?: boolean; notifyClient?: boolean }): Promise<ActionResult> {
  try {
    const ctx = await requireCtx();
    const a = await loadAppointment(ctx, input.id);
    if (input.professionalId) assertCanManage(ctx, input.professionalId);
    const min = hhmmToMinutes(input.time);
    if (!isValidLocalDate(input.date) || min === null) return { ok: false, error: "Data ou horário inválido." };
    const startsAt = localToUtc(input.date, min, ctx.org.timezone);
    await rescheduleAppointment({
      orgId: ctx.org.id, appointmentId: a.id, startsAt, professionalId: input.professionalId, mode: "panel",
      allowOutsideHours: input.allowOutsideHours, actor: actor(ctx),
    });
    await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "appointment.rescheduled", entity: "appointment", entityId: a.id, data: { from: a.startsAt, to: startsAt } });
    if (input.notifyClient !== false) {
      const token = await rotateManageToken(a.id);
      after(() => notifyAppointment({ appointmentId: a.id, key: "booking_rescheduled_client", manageToken: token }));
    }
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const statusSchema = z.enum(["pending", "confirmed", "completed", "cancelled_by_client", "cancelled_by_business", "no_show"]);

export async function changeStatusAction(input: { id: string; status: z.infer<typeof statusSchema>; reason?: string; notifyClient?: boolean }): Promise<ActionResult> {
  try {
    const ctx = await requireCtx();
    const status = statusSchema.parse(input.status);
    const a = await loadAppointment(ctx, input.id);
    await changeStatus({ orgId: ctx.org.id, appointmentId: a.id, status, reason: input.reason?.slice(0, 500), actor: actor(ctx) });
    await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: `appointment.${status}`, entity: "appointment", entityId: a.id, data: { from: a.status, reason: input.reason ?? "" } });
    if (input.notifyClient !== false) {
      if (status === "cancelled_by_business") after(() => notifyAppointment({ appointmentId: a.id, key: "booking_cancelled_client" }));
      if (status === "confirmed" && a.status === "pending") {
        const token = await rotateManageToken(a.id);
        after(() => notifyAppointment({ appointmentId: a.id, key: "booking_confirmed_client", manageToken: token }));
      }
    }
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const updateSchema = z.object({
  id: z.uuid(),
  priceCents: z.number().int().min(0),
  discountCents: z.number().int().min(0),
  paidCents: z.number().int().min(0),
  paymentMethod: z.enum(["", "pix", "cartao_credito", "cartao_debito", "dinheiro", "outro"]),
  internalNotes: z.string().max(4000),
});

export async function updateAppointmentAction(input: z.input<typeof updateSchema>): Promise<ActionResult> {
  try {
    const ctx = await requireCtx();
    const d = updateSchema.parse(input);
    const a = await loadAppointment(ctx, d.id);
    if (d.discountCents > d.priceCents) return { ok: false, error: "O desconto não pode ser maior que o preço." };
    await db.update(schema.appointments).set({
      priceCents: d.priceCents, discountCents: d.discountCents, paidCents: d.paidCents, paymentMethod: d.paymentMethod,
      internalNotes: d.internalNotes, updatedAt: new Date(),
    }).where(eq(schema.appointments.id, a.id));
    await db.insert(schema.appointmentEvents).values({
      organizationId: ctx.org.id, appointmentId: a.id, action: "updated", actorType: "user", actorUserId: ctx.user.id, actorLabel: ctx.user.name, source: "panel",
      data: {
        priceCents: [a.priceCents, d.priceCents], discountCents: [a.discountCents, d.discountCents], paidCents: [a.paidCents, d.paidCents], paymentMethod: [a.paymentMethod, d.paymentMethod],
      },
    });
    revalidatePath(`/painel/agendamentos/${a.id}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resendLinkAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireCtx();
    const a = await loadAppointment(ctx, id);
    const token = await rotateManageToken(a.id);
    after(() => notifyAppointment({ appointmentId: a.id, key: a.status === "pending" ? "booking_pending_client" : "booking_confirmed_client", manageToken: token }));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ------------------------------ Bloqueios ----------------------------- */

const blockSchema = z.object({
  professionalId: z.string(), // uuid ou "all"
  date: z.string().refine(isValidLocalDate, "Data inválida."),
  endDate: z.string().refine(isValidLocalDate, "Data final inválida."),
  allDay: z.boolean(),
  startTime: z.string(),
  endTime: z.string(),
  kind: z.enum(["personal", "break", "vacation", "holiday", "maintenance", "other"]),
  title: z.string().trim().max(200).default(""),
  recurrence: z.enum(["none", "daily", "weekly"]),
  recurrenceUntil: z.string().default(""),
  conflictMode: z.enum(["prevent", "keep", "cancel"]).default("prevent"),
});

export async function createBlockAction(input: z.input<typeof blockSchema>): Promise<ActionResult> {
  try {
    const ctx = await requireCtx();
    const parsed = blockSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const d = parsed.data;
    const tz = ctx.org.timezone;
    const professionalId = d.professionalId === "all" ? null : d.professionalId;
    if (professionalId === null && !ctx.can("agenda.manage_all")) throw new BookingError("forbidden", "Só a administração pode bloquear a agenda de todos.");
    assertCanManage(ctx, professionalId ?? ctx.professionalId);

    let startsAt: Date, endsAt: Date;
    if (d.allDay) {
      startsAt = localToUtc(d.date, 0, tz);
      endsAt = localToUtc(addDays(d.endDate < d.date ? d.date : d.endDate, 1), 0, tz);
    } else {
      const s = hhmmToMinutes(d.startTime);
      const e = hhmmToMinutes(d.endTime);
      if (s === null || e === null) return { ok: false, error: "Informe início e fim." };
      startsAt = localToUtc(d.date, s, tz);
      endsAt = localToUtc(d.endDate < d.date ? d.date : d.endDate, e, tz);
      if (endsAt <= startsAt) return { ok: false, error: "O fim precisa ser depois do início." };
    }
    const recurrenceUntil = d.recurrence !== "none" && isValidLocalDate(d.recurrenceUntil) ? d.recurrenceUntil : null;
    if (d.recurrence !== "none" && endsAt.getTime() - startsAt.getTime() > (d.recurrence === "daily" ? 86400000 : 7 * 86400000)) {
      return { ok: false, error: "Um bloqueio que se repete não pode ser mais longo que o intervalo de repetição." };
    }

    const conflicts = await findBlockConflicts({ orgId: ctx.org.id, tz, professionalId, startsAt, endsAt, recurrence: d.recurrence, recurrenceUntil });
    if (conflicts.length > 0 && d.conflictMode === "prevent") {
      return {
        ok: false,
        code: "conflict",
        error: conflicts.length === 1 ? "Existe 1 agendamento nesse período." : `Existem ${conflicts.length} agendamentos nesse período.`,
        conflicts: conflicts.map((c) => ({ id: c.appt.id, client: c.clientName, service: c.appt.serviceName, professional: c.profName, startsAt: c.appt.startsAt.toISOString() })),
      };
    }
    if (conflicts.length > 0 && d.conflictMode === "cancel") {
      for (const c of conflicts) assertCanManage(ctx, c.appt.professionalId);
      for (const c of conflicts) {
        await changeStatus({ orgId: ctx.org.id, appointmentId: c.appt.id, status: "cancelled_by_business", reason: "Agenda fechada no período", actor: actor(ctx) });
        after(() => notifyAppointment({ appointmentId: c.appt.id, key: "booking_cancelled_client" }));
      }
    }

    const [block] = await db.insert(schema.availabilityBlocks).values({
      organizationId: ctx.org.id, professionalId, title: d.title, kind: d.kind, startsAt, endsAt,
      recurrence: d.recurrence, recurrenceUntil, createdByUserId: ctx.user.id,
    }).returning();
    await audit({
      organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "block.created", entity: "availability_block", entityId: block.id,
      data: { conflictMode: d.conflictMode, conflicts: conflicts.length, kind: d.kind, recurrence: d.recurrence },
    });
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBlockAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await requireCtx();
    const [b] = await db.select().from(schema.availabilityBlocks)
      .where(and(eq(schema.availabilityBlocks.id, id), eq(schema.availabilityBlocks.organizationId, ctx.org.id))).limit(1);
    if (!b) return { ok: false, error: "Bloqueio não encontrado." };
    if (b.professionalId === null && !ctx.can("agenda.manage_all")) throw new BookingError("forbidden", "Sem permissão.");
    assertCanManage(ctx, b.professionalId ?? ctx.professionalId);
    await db.delete(schema.availabilityBlocks).where(eq(schema.availabilityBlocks.id, b.id));
    await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "block.deleted", entity: "availability_block", entityId: b.id, data: { title: b.title, startsAt: b.startsAt, endsAt: b.endsAt } });
    revalidatePath("/painel");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

