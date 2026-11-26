import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";

/** Diagnóstico do banco (protegido pelo CRON_SECRET): consultas em paralelo + transação desfeita no fim. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("k");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const t0 = Date.now();
  const steps: Record<string, number | string> = {};
  try {
    await db.execute(sql`select 1`);
    steps.select = Date.now() - t0;
    await Promise.all([
      db.select().from(schema.organizations).limit(1),
      db.select().from(schema.users).limit(1),
      db.select().from(schema.sessions).limit(1),
      db.select().from(schema.services).limit(1),
    ]);
    steps.parallel = Date.now() - t0;
    const id = `saude:${Date.now()}`;
    await db.transaction(async (tx) => {
      await tx.insert(schema.processedWebhooks).values({ id });
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
      tx.rollback();
    }).catch((e) => { if (!String(e?.message ?? e).toLowerCase().includes("rollback")) throw e; });
    steps.transaction = Date.now() - t0;
    const [{ n }] = (await db.execute(sql`select count(*)::int as n from organizations`)) as unknown as { n: number }[];
    steps.organizations = n;
    const orgs = await db.execute(sql`select o.slug, o.name, o.created_at,
      (select count(*)::int from organization_members m where m.organization_id = o.id) as members,
      (select count(*)::int from appointments a where a.organization_id = o.id) as appointments
      from organizations o order by o.created_at`);
    steps.orgs = JSON.stringify(orgs);
    return NextResponse.json({ ok: true, steps }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, steps, error: String((e as Error).message) }, { status: 500 });
  }
}
