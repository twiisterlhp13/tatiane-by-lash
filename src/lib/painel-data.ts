import "server-only";
import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Ctx } from "./auth";
import type { Ag, Despesa, ItemEstoque } from "./negocio";
import { resumoHorario } from "./horario";
import { addDays, toLocalDate } from "./time";

const DAY = 86400000;

/** Agendamentos com cliente e profissional, respeitando o que a usuária pode ver. */
export async function loadAgs(ctx: Ctx, opts: { pastDays?: number; futureDays?: number } = {}): Promise<Ag[]> {
  const now = Date.now();
  const from = new Date(now - (opts.pastDays ?? 400) * DAY);
  const to = new Date(now + (opts.futureDays ?? 120) * DAY);
  const onlyOwn = !ctx.can("agenda.view_all");
  const rows = await db
    .select({
      id: schema.appointments.id,
      code: schema.appointments.code,
      startsAt: schema.appointments.startsAt,
      endsAt: schema.appointments.endsAt,
      status: schema.appointments.status,
      clientId: schema.appointments.clientId,
      clientName: schema.clients.name,
      clientPhone: schema.clients.phone,
      serviceName: schema.appointments.serviceName,
      priceCents: schema.appointments.priceCents,
      discountCents: schema.appointments.discountCents,
      professionalId: schema.appointments.professionalId,
      professionalName: schema.professionals.name,
      clientNotes: schema.appointments.clientNotes,
      internalNotes: schema.appointments.internalNotes,
    })
    .from(schema.appointments)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.appointments.clientId))
    .innerJoin(schema.professionals, eq(schema.professionals.id, schema.appointments.professionalId))
    .where(and(
      eq(schema.appointments.organizationId, ctx.org.id),
      gte(schema.appointments.startsAt, from),
      lt(schema.appointments.startsAt, to),
      onlyOwn ? eq(schema.appointments.professionalId, ctx.professionalId ?? "00000000-0000-0000-0000-000000000000") : undefined,
    ))
    .orderBy(asc(schema.appointments.startsAt))
    .limit(5000);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status,
    clientId: r.clientId,
    clientName: r.clientName,
    clientPhone: ctx.can("clients.view_phone") ? r.clientPhone : "",
    serviceName: r.serviceName,
    valueCents: Math.max(0, r.priceCents - r.discountCents),
    professionalId: r.professionalId,
    professionalName: r.professionalName,
    notes: [r.clientNotes, r.internalNotes].filter(Boolean).join(" · "),
  }));
}

export async function loadDespesas(orgId: string, fromDate: string): Promise<Despesa[]> {
  const rows = await db.select().from(schema.expenses)
    .where(and(eq(schema.expenses.organizationId, orgId), gte(schema.expenses.spentOn, fromDate)))
    .orderBy(desc(schema.expenses.spentOn), desc(schema.expenses.createdAt))
    .limit(1000);
  return rows.map((r) => ({ id: r.id, description: r.description, category: r.category, amountCents: r.amountCents, spentOn: r.spentOn }));
}

export async function loadEstoque(orgId: string): Promise<ItemEstoque[]> {
  const rows = await db.select().from(schema.inventoryItems)
    .where(eq(schema.inventoryItems.organizationId, orgId))
    .orderBy(asc(schema.inventoryItems.name));
  return rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit, quantity: r.quantity, minimum: r.minimum }));
}

export async function loadClientes(orgId: string) {
  return db.select({
    id: schema.clients.id,
    name: schema.clients.name,
    phone: schema.clients.phone,
    birthDate: schema.clients.birthDate,
    notes: schema.clients.notes,
    createdAt: schema.clients.createdAt,
  })
    .from(schema.clients)
    .where(and(eq(schema.clients.organizationId, orgId), isNull(schema.clients.anonymizedAt)))
    .orderBy(asc(schema.clients.name));
}

export async function loadServicos(orgId: string) {
  return db.select().from(schema.services)
    .where(and(eq(schema.services.organizationId, orgId), eq(schema.services.active, true)))
    .orderBy(asc(schema.services.sortOrder), asc(schema.services.name));
}

export async function loadProfissionais(orgId: string) {
  return db.select().from(schema.professionals)
    .where(and(eq(schema.professionals.organizationId, orgId), eq(schema.professionals.active, true)))
    .orderBy(asc(schema.professionals.sortOrder), asc(schema.professionals.name));
}

/** Horário de atendimento resumido (para a vitrine e para a IA). */
export async function loadHorario(orgId: string, professionalId: string | null) {
  const rows = professionalId
    ? await db.select().from(schema.professionalHours).where(and(eq(schema.professionalHours.organizationId, orgId), eq(schema.professionalHours.professionalId, professionalId)))
    : await db.select().from(schema.businessHours).where(eq(schema.businessHours.organizationId, orgId));
  return resumoHorario(rows);
}

export { resumoHorario, textoHorario } from "./horario";

export function hojeLocal(tz: string) {
  return toLocalDate(new Date(), tz);
}

export { addDays };
