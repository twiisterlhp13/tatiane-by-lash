import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCtx } from "@/lib/auth";
import { expandBlocks } from "@/lib/availability";
import { addDays, isValidLocalDate, localMinuteOfDay, localToUtc, toLocalDate } from "@/lib/time";

export type AgendaItem = {
  kind: "appointment" | "block";
  id: string;
  date: string;
  startMin: number;
  endMin: number;
  professionalId: string | null;
  // agendamento
  status?: string;
  client?: string;
  service?: string;
  code?: string;
  startsAt?: string;
  // bloqueio
  title?: string;
  blockKind?: string;
  recurring?: boolean;
};

/** Divide um intervalo em pedaços por dia local (bloqueios de vários dias, atendimentos que cruzam a meia-noite). */
function splitByDay(start: Date, end: Date, tz: string) {
  const out: { date: string; startMin: number; endMin: number }[] = [];
  let cursor = start;
  for (let guard = 0; guard < 400 && cursor < end; guard++) {
    const date = toLocalDate(cursor, tz);
    const nextDay = localToUtc(addDays(date, 1), 0, tz);
    const segEnd = end < nextDay ? end : nextDay;
    out.push({ date, startMin: localMinuteOfDay(cursor, tz), endMin: segEnd.getTime() === nextDay.getTime() ? 1440 : localMinuteOfDay(segEnd, tz) });
    cursor = segEnd;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const tz = ctx.org.timezone;
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  if (!isValidLocalDate(from) || !isValidLocalDate(to) || to < from) {
    return NextResponse.json({ error: "Período inválido" }, { status: 400 });
  }
  const fromUtc = localToUtc(from, 0, tz);
  const toUtc = localToUtc(addDays(to, 1), 0, tz);
  if (toUtc.getTime() - fromUtc.getTime() > 45 * 86400000) return NextResponse.json({ error: "Período muito longo" }, { status: 400 });

  let profFilter = sp.get("prof") || "all";
  if (!ctx.can("agenda.view_all")) profFilter = ctx.professionalId ?? "none";
  const profIds =
    profFilter === "all"
      ? (await db.select({ id: schema.professionals.id }).from(schema.professionals).where(eq(schema.professionals.organizationId, ctx.org.id))).map((p) => p.id)
      : [profFilter];
  if (profIds.length === 0) return NextResponse.json({ items: [] });

  const statusFilter = sp.get("status");
  const showCancelled = sp.get("cancelled") === "1";

  const [appts, blocks] = await Promise.all([
    db.select({ a: schema.appointments, client: schema.clients.name })
      .from(schema.appointments)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.appointments.clientId))
      .where(and(
        eq(schema.appointments.organizationId, ctx.org.id),
        inArray(schema.appointments.professionalId, profIds),
        lt(schema.appointments.startsAt, toUtc),
        gt(schema.appointments.endsAt, fromUtc),
        statusFilter ? eq(schema.appointments.status, statusFilter as "pending") : undefined,
        showCancelled ? undefined : inArray(schema.appointments.status, ["pending", "confirmed", "completed", "no_show"]),
      )),
    db.select().from(schema.availabilityBlocks).where(and(
      eq(schema.availabilityBlocks.organizationId, ctx.org.id),
      or(isNull(schema.availabilityBlocks.professionalId), inArray(schema.availabilityBlocks.professionalId, profIds)),
      lt(schema.availabilityBlocks.startsAt, toUtc),
      or(gt(schema.availabilityBlocks.endsAt, fromUtc), ne(schema.availabilityBlocks.recurrence, "none")),
    )),
  ]);

  const items: AgendaItem[] = [];
  for (const { a, client } of appts) {
    for (const seg of splitByDay(a.startsAt, a.endsAt, tz)) {
      items.push({
        kind: "appointment", id: a.id, ...seg, professionalId: a.professionalId, status: a.status, client,
        service: a.serviceName, code: a.code, startsAt: a.startsAt.toISOString(),
      });
    }
  }
  for (const b of blocks) {
    const occ = expandBlocks([{ professionalId: b.professionalId, startsAt: b.startsAt, endsAt: b.endsAt, recurrence: b.recurrence, recurrenceUntil: b.recurrenceUntil }], fromUtc, toUtc, tz);
    for (const o of occ) {
      for (const seg of splitByDay(o.start < fromUtc ? fromUtc : o.start, o.end > toUtc ? toUtc : o.end, tz)) {
        items.push({ kind: "block", id: b.id, ...seg, professionalId: b.professionalId, title: b.title, blockKind: b.kind, recurring: b.recurrence !== "none" });
      }
    }
  }
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
