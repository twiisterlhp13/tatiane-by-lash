import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt, inArray, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { notifyAppointment } from "@/lib/notify";
import { orgSettings } from "@/lib/booking";

/**
 * Envia lembretes (24h e 2h antes). Chamado pelo Vercel Cron.
 * Idempotente: cada lembrete tem chave de deduplicação e marca de envio no agendamento.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const now = Date.now();
  const H = 3600000;
  let sent24 = 0, sent2 = 0;

  // Na véspera: atendimentos que começam entre agora+2h e agora+36h e ainda não receberam o lembrete
  const upcoming24 = await db
    .select({ a: schema.appointments, org: schema.organizations })
    .from(schema.appointments)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.appointments.organizationId))
    .where(and(
      inArray(schema.appointments.status, ["pending", "confirmed"]),
      gt(schema.appointments.startsAt, new Date(now + 2 * H)),
      lt(schema.appointments.startsAt, new Date(now + 36 * H)),
      isNull(schema.appointments.reminder24hSentAt),
    ))
    .limit(500);
  for (const { a, org } of upcoming24) {
    if (!orgSettings(org).reminder24h) continue;
    await db.update(schema.appointments).set({ reminder24hSentAt: new Date() }).where(eq(schema.appointments.id, a.id));
    await notifyAppointment({ appointmentId: a.id, key: "reminder_24h", dedupeKey: `${a.id}:reminder_24h:${a.startsAt.toISOString()}` });
    sent24++;
  }

  // Cerca de 2h antes (efetivo quando o cron roda com frequência suficiente)
  const upcoming2 = await db
    .select({ a: schema.appointments, org: schema.organizations })
    .from(schema.appointments)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.appointments.organizationId))
    .where(and(
      inArray(schema.appointments.status, ["pending", "confirmed"]),
      gt(schema.appointments.startsAt, new Date(now)),
      lt(schema.appointments.startsAt, new Date(now + 3 * H)),
      isNull(schema.appointments.reminder2hSentAt),
    ))
    .limit(500);
  for (const { a, org } of upcoming2) {
    if (!orgSettings(org).reminder2h) continue;
    await db.update(schema.appointments).set({ reminder2hSentAt: new Date() }).where(eq(schema.appointments.id, a.id));
    await notifyAppointment({ appointmentId: a.id, key: "reminder_2h", dedupeKey: `${a.id}:reminder_2h:${a.startsAt.toISOString()}` });
    sent2++;
  }

  // limpeza de sessões expiradas
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));

  return NextResponse.json({ ok: true, sent24, sent2 });
}
