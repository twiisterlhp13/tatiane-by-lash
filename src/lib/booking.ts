import "server-only";
import { and, asc, eq, gt, gte, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db, schema, type Tx, type DB } from "@/db";
import { defaultOrgSettings, type OrgSettings } from "@/db/schema";
import {
  checkInterval,
  expandBlocks,
  mergeSlots,
  overlaps,
  slotsForDate,
  type BlockInput,
  type ProfessionalSchedule,
  type SlotOption,
} from "./availability";
import { addDays, localToUtc, toLocalDate, type LocalDate } from "./time";
import { appointmentCode, normalizePhone, randomToken, sha256 } from "./security";

export class BookingError extends Error {
  constructor(
    public code:
      | "not_found"
      | "slot_taken"
      | "invalid"
      | "outside_hours"
      | "blocked"
      | "conflict"
      | "policy"
      | "disabled"
      | "forbidden",
    message: string,
  ) {
    super(message);
  }
}

export const ACTIVE_STATUSES = ["pending", "confirmed"] as const;
type AnyDb = DB | Tx;

export type OrgRow = typeof schema.organizations.$inferSelect;
export function orgSettings(org: Pick<OrgRow, "settings">): OrgSettings {
  return { ...defaultOrgSettings, ...(org.settings ?? {}) };
}

export async function getOrgBySlug(slug: string) {
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, slug)).limit(1);
  return org ?? null;
}

/* ------------------------------------------------------------------ */
/* Carregamento da agenda                                              */
/* ------------------------------------------------------------------ */

export async function loadSchedules(
  q: AnyDb,
  orgId: string,
  professionalIds: string[],
  from: Date,
  to: Date,
  tz: string,
  opts: { excludeAppointmentId?: string } = {},
): Promise<ProfessionalSchedule[]> {
  if (professionalIds.length === 0) return [];
  const fromDate = toLocalDate(from, tz);
  const toDate = toLocalDate(to, tz);

  const [weekly, special, busy, blocks] = await Promise.all([
    q.select().from(schema.professionalHours).where(
      and(eq(schema.professionalHours.organizationId, orgId), inArray(schema.professionalHours.professionalId, professionalIds)),
    ),
    q.select().from(schema.specialHours).where(
      and(
        eq(schema.specialHours.organizationId, orgId),
        inArray(schema.specialHours.professionalId, professionalIds),
        gte(schema.specialHours.date, addDays(fromDate, -1)),
        lt(schema.specialHours.date, addDays(toDate, 2)),
      ),
    ),
    q.select({
      id: schema.appointments.id,
      professionalId: schema.appointments.professionalId,
      startsAt: schema.appointments.startsAt,
      occupiedUntil: schema.appointments.occupiedUntil,
    }).from(schema.appointments).where(
      and(
        eq(schema.appointments.organizationId, orgId),
        inArray(schema.appointments.professionalId, professionalIds),
        inArray(schema.appointments.status, [...ACTIVE_STATUSES]),
        lt(schema.appointments.startsAt, to),
        gt(schema.appointments.occupiedUntil, from),
        opts.excludeAppointmentId ? ne(schema.appointments.id, opts.excludeAppointmentId) : undefined,
      ),
    ),
    q.select().from(schema.availabilityBlocks).where(
      and(
        eq(schema.availabilityBlocks.organizationId, orgId),
        or(isNull(schema.availabilityBlocks.professionalId), inArray(schema.availabilityBlocks.professionalId, professionalIds)),
        lt(schema.availabilityBlocks.startsAt, to),
        or(
          gt(schema.availabilityBlocks.endsAt, from),
          and(
            ne(schema.availabilityBlocks.recurrence, "none"),
            or(isNull(schema.availabilityBlocks.recurrenceUntil), gte(schema.availabilityBlocks.recurrenceUntil, addDays(fromDate, -60))),
          ),
        ),
      ),
    ),
  ]);

  return professionalIds.map((pid) => ({
    professionalId: pid,
    weekly: weekly.filter((h) => h.professionalId === pid),
    special: special.filter((s) => s.professionalId === pid).map((s) => ({ date: s.date, startMinute: s.startMinute, endMinute: s.endMinute })),
    busy: busy.filter((b) => b.professionalId === pid).map((b) => ({ start: b.startsAt, end: b.occupiedUntil })),
    blocks: blocks
      .filter((b) => b.professionalId === null || b.professionalId === pid)
      .map<BlockInput>((b) => ({
        professionalId: b.professionalId,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        recurrence: b.recurrence,
        recurrenceUntil: b.recurrenceUntil,
      })),
  }));
}

/** Profissionais que atendem o serviço e aceitam agendamento online. */
export async function bookableProfessionals(q: AnyDb, orgId: string, serviceId: string) {
  return q
    .select({ id: schema.professionals.id, name: schema.professionals.name, photoUrl: schema.professionals.photoUrl, sortOrder: schema.professionals.sortOrder })
    .from(schema.professionals)
    .innerJoin(schema.professionalServices, eq(schema.professionalServices.professionalId, schema.professionals.id))
    .where(
      and(
        eq(schema.professionals.organizationId, orgId),
        eq(schema.professionalServices.serviceId, serviceId),
        eq(schema.professionals.active, true),
        eq(schema.professionals.acceptsOnline, true),
      ),
    )
    .orderBy(asc(schema.professionals.sortOrder), asc(schema.professionals.name));
}

async function getBookableService(q: AnyDb, orgId: string, serviceId: string) {
  const [service] = await q
    .select()
    .from(schema.services)
    .where(and(eq(schema.services.id, serviceId), eq(schema.services.organizationId, orgId), eq(schema.services.active, true), eq(schema.services.onlineVisible, true)))
    .limit(1);
  if (!service) throw new BookingError("not_found", "Serviço não encontrado.");
  return service;
}

/* ------------------------------------------------------------------ */
/* Disponibilidade pública                                             */
/* ------------------------------------------------------------------ */

export async function publicAvailability(args: {
  org: OrgRow;
  serviceId: string;
  professionalId: string | "any";
  fromDate: LocalDate;
  days: number;
  now?: Date;
  excludeAppointmentId?: string;
  q?: AnyDb;
}): Promise<{ date: LocalDate; slots: SlotOption[] }[]> {
  const q = args.q ?? db;
  const { org } = args;
  const tz = org.timezone;
  const settings = orgSettings(org);
  const now = args.now ?? new Date();
  const service = await getBookableService(q, org.id, args.serviceId);
  let pros = await bookableProfessionals(q, org.id, service.id);
  if (args.professionalId !== "any") pros = pros.filter((p) => p.id === args.professionalId);
  if (pros.length === 0) return [];

  const days = Math.max(1, Math.min(args.days, 62));
  const from = localToUtc(args.fromDate, 0, tz);
  const to = localToUtc(addDays(args.fromDate, days), 0, tz);
  const schedules = await loadSchedules(q, org.id, pros.map((p) => p.id), new Date(from.getTime() - 86400000), new Date(to.getTime() + 86400000), tz, {
    excludeAppointmentId: args.excludeAppointmentId,
  });
  const rules = {
    durationMinutes: service.durationMinutes,
    bufferMinutes: service.bufferMinutes,
    stepMinutes: settings.slotIntervalMinutes,
    earliest: new Date(now.getTime() + settings.minAdvanceMinutes * 60000),
    latest: new Date(now.getTime() + settings.maxAdvanceDays * 86400000),
  };
  const out: { date: LocalDate; slots: SlotOption[] }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(args.fromDate, i);
    const per = schedules.map((s) => ({ professionalId: s.professionalId, slots: slotsForDate(s, date, rules, tz) }));
    out.push({ date, slots: mergeSlots(per) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Criação de agendamento online (com revalidação e anti dupla reserva)*/
/* ------------------------------------------------------------------ */

function isExclusionViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23P01" || err?.cause?.code === "23P01";
}

async function lockProfessional(tx: Tx, professionalId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${professionalId}))`);
}

export async function upsertClient(
  tx: AnyDb,
  orgId: string,
  input: { name: string; phone: string; email?: string; marketingConsent?: boolean; acceptTerms?: boolean },
) {
  const phoneNormalized = normalizePhone(input.phone);
  const [existing] = await tx
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.organizationId, orgId), eq(schema.clients.phoneNormalized, phoneNormalized), isNull(schema.clients.anonymizedAt)))
    .limit(1);
  const now = new Date();
  if (existing) {
    const [updated] = await tx
      .update(schema.clients)
      .set({
        name: input.name || existing.name,
        email: input.email || existing.email,
        termsAcceptedAt: input.acceptTerms ? now : existing.termsAcceptedAt,
        ...(input.marketingConsent !== undefined && input.acceptTerms
          ? { marketingConsent: input.marketingConsent, marketingConsentAt: input.marketingConsent ? now : null }
          : {}),
        updatedAt: now,
      })
      .where(eq(schema.clients.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await tx
    .insert(schema.clients)
    .values({
      organizationId: orgId,
      name: input.name,
      phone: input.phone,
      phoneNormalized,
      email: input.email ?? "",
      termsAcceptedAt: input.acceptTerms ? now : null,
      marketingConsent: !!input.marketingConsent,
      marketingConsentAt: input.marketingConsent ? now : null,
    })
    .returning();
  return created;
}

async function uniqueCode(tx: AnyDb, orgId: string) {
  for (let i = 0; i < 6; i++) {
    const code = appointmentCode();
    const [hit] = await tx.select({ id: schema.appointments.id }).from(schema.appointments)
      .where(and(eq(schema.appointments.organizationId, orgId), eq(schema.appointments.code, code))).limit(1);
    if (!hit) return code;
  }
  throw new Error("Não foi possível gerar código único");
}

export async function createOnlineBooking(args: {
  org: OrgRow;
  serviceId: string;
  professionalId: string | "any";
  startsAt: Date;
  client: { name: string; phone: string; email: string; notes: string; marketingConsent: boolean };
  idempotencyKey: string;
  now?: Date;
}) {
  const { org } = args;
  if (!org.onlineBookingEnabled) throw new BookingError("disabled", "O agendamento online está desativado no momento.");
  const settings = orgSettings(org);
  const tz = org.timezone;

  // Idempotência: um reenvio do mesmo formulário retorna o mesmo agendamento
  const [already] = await db.select().from(schema.appointments)
    .where(and(eq(schema.appointments.organizationId, org.id), eq(schema.appointments.idempotencyKey, args.idempotencyKey))).limit(1);
  if (already) return { appointment: already, manageToken: null as string | null, duplicate: true };

  const date = toLocalDate(args.startsAt, tz);
  const service = await getBookableService(db, org.id, args.serviceId);
  const candidates =
    args.professionalId === "any"
      ? (await bookableProfessionals(db, org.id, service.id)).map((p) => p.id)
      : [args.professionalId];

  for (const professionalId of candidates) {
    try {
      const result = await db.transaction(async (tx) => {
        await lockProfessional(tx, professionalId);
        // Revalida no servidor, dentro da transação, com o lock do profissional
        const avail = await publicAvailability({ org, serviceId: service.id, professionalId, fromDate: date, days: 1, now: args.now, q: tx });
        const ok = avail[0]?.slots.some((s) => s.start.getTime() === args.startsAt.getTime());
        if (!ok) return null;

        const client = await upsertClient(tx, org.id, {
          name: args.client.name,
          phone: args.client.phone,
          email: args.client.email,
          marketingConsent: args.client.marketingConsent,
          acceptTerms: true,
        });
        const token = randomToken(24);
        const endsAt = new Date(args.startsAt.getTime() + service.durationMinutes * 60000);
        const status = settings.autoConfirmOnline ? "confirmed" : "pending";
        const [appt] = await tx.insert(schema.appointments).values({
          organizationId: org.id,
          code: await uniqueCode(tx, org.id),
          clientId: client.id,
          serviceId: service.id,
          professionalId,
          startsAt: args.startsAt,
          endsAt,
          occupiedUntil: new Date(endsAt.getTime() + service.bufferMinutes * 60000),
          status,
          source: "online",
          serviceName: service.name,
          priceCents: service.priceCents,
          clientNotes: args.client.notes,
          manageTokenHash: sha256(token),
          idempotencyKey: args.idempotencyKey,
        }).returning();
        await tx.insert(schema.appointmentEvents).values({
          organizationId: org.id,
          appointmentId: appt.id,
          action: "created",
          toStatus: status,
          actorType: "client",
          actorLabel: client.name,
          source: "online",
        });
        return { appointment: appt, manageToken: token, duplicate: false };
      });
      if (result) return result;
    } catch (e) {
      if (isExclusionViolation(e)) continue; // outro pedido ganhou a corrida; tenta o próximo profissional
      throw e;
    }
  }
  throw new BookingError("slot_taken", "Esse horário acabou de ficar indisponível. Escolha outro, por favor.");
}

/* ------------------------------------------------------------------ */
/* Operações sobre agendamentos existentes                             */
/* ------------------------------------------------------------------ */

type Actor = { type: "user" | "client" | "system"; userId?: string | null; label: string; source: "panel" | "online" | "cron" };

export async function rescheduleAppointment(args: {
  orgId: string;
  appointmentId: string;
  startsAt: Date;
  professionalId?: string;
  actor: Actor;
  /** Cliente: precisa respeitar horários públicos. Painel: pode encaixar fora do expediente se confirmado. */
  mode: "client" | "panel";
  allowOutsideHours?: boolean;
  reason?: string;
}) {
  const [appt] = await db.select().from(schema.appointments)
    .where(and(eq(schema.appointments.id, args.appointmentId), eq(schema.appointments.organizationId, args.orgId))).limit(1);
  if (!appt) throw new BookingError("not_found", "Agendamento não encontrado.");
  if (!ACTIVE_STATUSES.includes(appt.status as (typeof ACTIVE_STATUSES)[number])) {
    throw new BookingError("invalid", "Só é possível reagendar agendamentos ativos.");
  }
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, args.orgId)).limit(1);
  const tz = org.timezone;
  const [service] = await db.select().from(schema.services).where(eq(schema.services.id, appt.serviceId)).limit(1);
  const professionalId = args.professionalId ?? appt.professionalId;
  const durationMs = appt.endsAt.getTime() - appt.startsAt.getTime();
  const bufferMs = appt.occupiedUntil.getTime() - appt.endsAt.getTime();

  try {
    return await db.transaction(async (tx) => {
      await lockProfessional(tx, professionalId);
      if (args.mode === "client") {
        const avail = await publicAvailability({
          org, serviceId: service.id, professionalId, fromDate: toLocalDate(args.startsAt, tz), days: 1, excludeAppointmentId: appt.id, q: tx,
        });
        if (!avail[0]?.slots.some((s) => s.start.getTime() === args.startsAt.getTime())) {
          throw new BookingError("slot_taken", "Esse horário não está mais disponível.");
        }
      } else {
        const interval = { start: args.startsAt, end: new Date(args.startsAt.getTime() + durationMs) };
        const [sched] = await loadSchedules(tx, org.id, [professionalId], new Date(interval.start.getTime() - 86400000), new Date(interval.end.getTime() + 86400000), tz, { excludeAppointmentId: appt.id });
        const check = checkInterval(sched, { start: interval.start, end: new Date(interval.end.getTime() + bufferMs) }, tz, { ignoreWorkingHours: args.allowOutsideHours });
        if (!check.ok) throw new BookingError(check.reason, reasonMessage(check.reason));
      }
      const [updated] = await tx.update(schema.appointments).set({
        startsAt: args.startsAt,
        endsAt: new Date(args.startsAt.getTime() + durationMs),
        occupiedUntil: new Date(args.startsAt.getTime() + durationMs + bufferMs),
        professionalId,
        reminder24hSentAt: null,
        reminder2hSentAt: null,
        updatedAt: new Date(),
      }).where(eq(schema.appointments.id, appt.id)).returning();
      await tx.insert(schema.appointmentEvents).values({
        organizationId: org.id,
        appointmentId: appt.id,
        action: "rescheduled",
        fromStatus: appt.status,
        toStatus: updated.status,
        actorType: args.actor.type,
        actorUserId: args.actor.userId ?? null,
        actorLabel: args.actor.label,
        source: args.actor.source,
        reason: args.reason ?? "",
        data: {
          from: { startsAt: appt.startsAt.toISOString(), professionalId: appt.professionalId },
          to: { startsAt: updated.startsAt.toISOString(), professionalId: updated.professionalId },
        },
      });
      return updated;
    });
  } catch (e) {
    if (isExclusionViolation(e)) throw new BookingError("slot_taken", "Esse horário acabou de ser ocupado.");
    throw e;
  }
}

export function reasonMessage(reason: "outside_hours" | "blocked" | "conflict") {
  return {
    outside_hours: "Fora do horário de trabalho do profissional.",
    blocked: "Esse período está bloqueado na agenda.",
    conflict: "Já existe um agendamento nesse horário.",
  }[reason];
}

const STATUS_ACTION: Record<string, string> = {
  confirmed: "confirmed",
  completed: "completed",
  cancelled_by_client: "cancelled",
  cancelled_by_business: "cancelled",
  no_show: "no_show",
  pending: "reopened",
};

export async function changeStatus(args: {
  orgId: string;
  appointmentId: string;
  status: "pending" | "confirmed" | "completed" | "cancelled_by_client" | "cancelled_by_business" | "no_show";
  actor: Actor;
  reason?: string;
}) {
  try {
    return await db.transaction(async (tx) => {
      const [appt] = await tx.select().from(schema.appointments)
        .where(and(eq(schema.appointments.id, args.appointmentId), eq(schema.appointments.organizationId, args.orgId))).limit(1).for("update");
      if (!appt) throw new BookingError("not_found", "Agendamento não encontrado.");
      if (appt.status === args.status) return appt;
      const [updated] = await tx.update(schema.appointments).set({
        status: args.status,
        cancelReason: args.status.startsWith("cancelled") ? (args.reason ?? "") : appt.cancelReason,
        updatedAt: new Date(),
      }).where(eq(schema.appointments.id, appt.id)).returning();
      await tx.insert(schema.appointmentEvents).values({
        organizationId: args.orgId,
        appointmentId: appt.id,
        action: STATUS_ACTION[args.status] ?? "updated",
        fromStatus: appt.status,
        toStatus: args.status,
        actorType: args.actor.type,
        actorUserId: args.actor.userId ?? null,
        actorLabel: args.actor.label,
        source: args.actor.source,
        reason: args.reason ?? "",
      });
      return updated;
    });
  } catch (e) {
    // reativar um agendamento cancelado cujo horário já foi ocupado
    if (isExclusionViolation(e)) throw new BookingError("slot_taken", "Esse horário já foi ocupado por outro agendamento.");
    throw e;
  }
}

/** Valida o token do link de gestão da cliente. */
export async function getAppointmentByToken(orgId: string, code: string, token: string) {
  const [row] = await db
    .select({ appt: schema.appointments, client: schema.clients, prof: schema.professionals })
    .from(schema.appointments)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.appointments.clientId))
    .innerJoin(schema.professionals, eq(schema.professionals.id, schema.appointments.professionalId))
    .where(and(eq(schema.appointments.organizationId, orgId), eq(schema.appointments.code, code.toUpperCase())))
    .limit(1);
  if (!row || !row.appt.manageTokenHash || row.appt.manageTokenHash !== sha256(token)) return null;
  return row;
}

/** Gera um novo link de gestão (usado quando o painel cria/reenvia o agendamento). */
export async function rotateManageToken(appointmentId: string) {
  const token = randomToken(24);
  await db.update(schema.appointments).set({ manageTokenHash: sha256(token) }).where(eq(schema.appointments.id, appointmentId));
  return token;
}

/* ------------------------------------------------------------------ */
/* Agendamento criado pelo painel                                      */
/* ------------------------------------------------------------------ */

export async function createPanelAppointment(args: {
  orgId: string;
  tz: string;
  clientId: string;
  serviceId: string;
  professionalId: string;
  startsAt: Date;
  priceCents?: number;
  discountCents?: number;
  internalNotes?: string;
  status: "pending" | "confirmed";
  allowOutsideHours: boolean;
  actor: Actor;
}) {
  const [service] = await db.select().from(schema.services)
    .where(and(eq(schema.services.id, args.serviceId), eq(schema.services.organizationId, args.orgId))).limit(1);
  if (!service) throw new BookingError("not_found", "Serviço não encontrado.");
  const [link] = await db.select().from(schema.professionalServices)
    .where(and(eq(schema.professionalServices.professionalId, args.professionalId), eq(schema.professionalServices.serviceId, service.id))).limit(1);
  if (!link) throw new BookingError("invalid", "Esse profissional não está habilitado para este serviço.");
  const [client] = await db.select().from(schema.clients)
    .where(and(eq(schema.clients.id, args.clientId), eq(schema.clients.organizationId, args.orgId))).limit(1);
  if (!client) throw new BookingError("not_found", "Cliente não encontrada.");

  const endsAt = new Date(args.startsAt.getTime() + service.durationMinutes * 60000);
  const occupiedUntil = new Date(endsAt.getTime() + service.bufferMinutes * 60000);
  try {
    return await db.transaction(async (tx) => {
      await lockProfessional(tx, args.professionalId);
      const [sched] = await loadSchedules(tx, args.orgId, [args.professionalId], new Date(args.startsAt.getTime() - 86400000), new Date(occupiedUntil.getTime() + 86400000), args.tz);
      const check = checkInterval(sched, { start: args.startsAt, end: occupiedUntil }, args.tz, { ignoreWorkingHours: args.allowOutsideHours });
      if (!check.ok) throw new BookingError(check.reason, reasonMessage(check.reason));
      const token = randomToken(24);
      const [appt] = await tx.insert(schema.appointments).values({
        organizationId: args.orgId,
        code: await uniqueCode(tx, args.orgId),
        clientId: client.id,
        serviceId: service.id,
        professionalId: args.professionalId,
        startsAt: args.startsAt,
        endsAt,
        occupiedUntil,
        status: args.status,
        source: "panel",
        serviceName: service.name,
        priceCents: args.priceCents ?? service.priceCents,
        discountCents: args.discountCents ?? 0,
        internalNotes: args.internalNotes ?? "",
        manageTokenHash: sha256(token),
      }).returning();
      await tx.insert(schema.appointmentEvents).values({
        organizationId: args.orgId,
        appointmentId: appt.id,
        action: "created",
        toStatus: args.status,
        actorType: args.actor.type,
        actorUserId: args.actor.userId ?? null,
        actorLabel: args.actor.label,
        source: "panel",
      });
      return { appointment: appt, manageToken: token };
    });
  } catch (e) {
    if (isExclusionViolation(e)) throw new BookingError("conflict", "Já existe um agendamento nesse horário.");
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Bloqueios                                                           */
/* ------------------------------------------------------------------ */

export async function findBlockConflicts(args: {
  orgId: string;
  tz: string;
  professionalId: string | null;
  startsAt: Date;
  endsAt: Date;
  recurrence: "none" | "daily" | "weekly";
  recurrenceUntil: LocalDate | null;
}) {
  const horizonEnd =
    args.recurrence === "none"
      ? args.endsAt
      : args.recurrenceUntil
        ? localToUtc(addDays(args.recurrenceUntil, 1), 0, args.tz)
        : new Date(args.startsAt.getTime() + 180 * 86400000);
  const appts = await db
    .select({ appt: schema.appointments, clientName: schema.clients.name, profName: schema.professionals.name })
    .from(schema.appointments)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.appointments.clientId))
    .innerJoin(schema.professionals, eq(schema.professionals.id, schema.appointments.professionalId))
    .where(
      and(
        eq(schema.appointments.organizationId, args.orgId),
        args.professionalId ? eq(schema.appointments.professionalId, args.professionalId) : undefined,
        inArray(schema.appointments.status, [...ACTIVE_STATUSES]),
        lt(schema.appointments.startsAt, horizonEnd),
        gt(schema.appointments.endsAt, args.startsAt),
      ),
    );
  const occurrences = expandBlocks(
    [{ professionalId: args.professionalId, startsAt: args.startsAt, endsAt: args.endsAt, recurrence: args.recurrence, recurrenceUntil: args.recurrenceUntil }],
    args.startsAt,
    horizonEnd,
    args.tz,
  );
  return appts.filter((a) => occurrences.some((o) => overlaps(o, { start: a.appt.startsAt, end: a.appt.endsAt })));
}
