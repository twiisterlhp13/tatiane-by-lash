import Link from "next/link";
import { and, asc, count, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { CheckCircle2, Circle, Clock, Globe } from "lucide-react";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { appUrl } from "@/lib/notify";
import { addDays, fmtDate, fmtLocalDateShort, fmtMoney, fmtTime, localToUtc, toLocalDate } from "@/lib/time";
import { StatusBadge } from "@/components/ui";
import { CopyLink } from "./copy-link";
import { Fab } from "./nav";
import { BarChart, DashSection, LineChart } from "./dash-ui";

async function rows<T>(query: SQL) {
  const r = (await db.execute(query)) as unknown as { rows: T[] };
  return r.rows;
}

export default async function Dashboard() {
  const ctx = await requireCtx();
  const tz = ctx.org.timezone;
  const today = toLocalDate(new Date(), tz);
  const NONE = "00000000-0000-0000-0000-000000000000";
  const ownOnly = !ctx.can("agenda.view_all");
  const profFilter = ownOnly ? sql`and a.professional_id = ${ctx.professionalId ?? NONE}` : sql``;
  const scope = () => (ownOnly ? eq(schema.appointments.professionalId, ctx.professionalId ?? NONE) : undefined);
  const showMoney = ctx.can("reports.view") || ownOnly;

  // períodos (no fuso da empresa)
  const firstMonth = (() => {
    const [y, m] = today.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 12, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  })();
  const months = Array.from({ length: 12 }, (_, i) => {
    const [y, m] = firstMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + i + 1, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const threeMonths = months.slice(-3);
  const fromYear = localToUtc(`${months[0]}-01`, 0, tz);
  const fromWeek = localToUtc(weekDays[0], 0, tz);
  const fromThree = localToUtc(`${threeMonths[0]}-01`, 0, tz);

  const [pending, yearAgg, weekAgg, away, topServices, topClients, latest, [svcCount], [hoursCount], [orgRow], [apptCount]] = await Promise.all([
    db.select({ a: schema.appointments, client: schema.clients.name })
      .from(schema.appointments)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.appointments.clientId))
      .where(and(eq(schema.appointments.organizationId, ctx.org.id), eq(schema.appointments.status, "pending"), gte(schema.appointments.startsAt, new Date()), scope()))
      .orderBy(asc(schema.appointments.startsAt)).limit(30),
    rows<{ ym: string; total: number }>(sql`
      select to_char(a.starts_at at time zone ${tz}, 'YYYY-MM') as ym, sum(a.price_cents - a.discount_cents)::int as total
      from appointments a where a.organization_id = ${ctx.org.id} and a.starts_at >= ${fromYear}
        and a.status in ('pending','confirmed','completed') ${profFilter}
      group by 1`),
    rows<{ d: string; total: number }>(sql`
      select to_char(a.starts_at at time zone ${tz}, 'YYYY-MM-DD') as d, sum(a.price_cents - a.discount_cents)::int as total
      from appointments a where a.organization_id = ${ctx.org.id} and a.starts_at >= ${fromWeek} and a.starts_at < ${localToUtc(addDays(today, 1), 0, tz)}
        and a.status in ('pending','confirmed','completed') ${profFilter}
      group by 1`),
    // clientes que não voltam há mais de 14 dias e não têm horário marcado
    rows<{ id: string; name: string; last: string }>(sql`
      select c.id, c.name, max(a.starts_at) as last
      from clients c join appointments a on a.client_id = c.id
      where c.organization_id = ${ctx.org.id} and c.anonymized_at is null and a.status = 'completed' ${profFilter}
      group by c.id, c.name
      having max(a.starts_at) < now() - interval '14 days'
        and not exists (select 1 from appointments f where f.client_id = c.id and f.status in ('pending','confirmed') and f.starts_at > now())
      order by max(a.starts_at) desc limit 20`),
    rows<{ name: string; ym: string; total: number }>(sql`
      select a.service_name as name, to_char(a.starts_at at time zone ${tz}, 'YYYY-MM') as ym, sum(a.price_cents - a.discount_cents)::int as total
      from appointments a where a.organization_id = ${ctx.org.id} and a.starts_at >= ${fromThree}
        and a.status in ('pending','confirmed','completed') ${profFilter}
      group by 1, 2`),
    rows<{ id: string; name: string; ym: string; total: number }>(sql`
      select c.id, c.name, to_char(a.starts_at at time zone ${tz}, 'YYYY-MM') as ym, sum(a.price_cents - a.discount_cents)::int as total
      from appointments a join clients c on c.id = a.client_id
      where a.organization_id = ${ctx.org.id} and a.starts_at >= ${fromThree}
        and a.status in ('pending','confirmed','completed') ${profFilter}
      group by 1, 2, 3`),
    db.select({ a: schema.appointments, client: schema.clients.name })
      .from(schema.appointments)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.appointments.clientId))
      .where(and(eq(schema.appointments.organizationId, ctx.org.id), scope()))
      .orderBy(desc(schema.appointments.createdAt)).limit(8),
    db.select({ n: count() }).from(schema.services).where(and(eq(schema.services.organizationId, ctx.org.id), eq(schema.services.active, true))),
    db.select({ n: count() }).from(schema.professionalHours).where(eq(schema.professionalHours.organizationId, ctx.org.id)),
    db.select().from(schema.organizations).where(eq(schema.organizations.id, ctx.org.id)),
    db.select({ n: count() }).from(schema.appointments).where(eq(schema.appointments.organizationId, ctx.org.id)),
  ]);

  const yearSeries = months.map((ym) => ({
    label: fmtLocalDateShort(`${ym}-01`, { month: "short" }).replace(".", "").toLowerCase(),
    value: (yearAgg.find((r) => r.ym === ym)?.total ?? 0) / 100,
  }));
  const weekSeries = weekDays.map((d) => ({
    label: fmtLocalDateShort(d, { weekday: "short" }).replace(".", "").toLowerCase(),
    value: (weekAgg.find((r) => r.d === d)?.total ?? 0) / 100,
    highlight: d === today,
  }));
  const pivot = <T extends { name: string; ym: string; total: number }>(list: T[], key: (r: T) => string) => {
    const map = new Map<string, { name: string; byMonth: Record<string, number>; sum: number }>();
    for (const r of list) {
      const k = key(r);
      const e = map.get(k) ?? { name: r.name, byMonth: {}, sum: 0 };
      e.byMonth[r.ym] = (e.byMonth[r.ym] ?? 0) + r.total;
      e.sum += r.total;
      map.set(k, e);
    }
    return [...map.values()].sort((a, b) => b.sum - a.sum).slice(0, 10);
  };
  const topSvc = pivot(topServices, (r) => r.name);
  const topCli = pivot(topClients, (r) => r.id);
  const monthLabel = (ym: string) => fmtLocalDateShort(`${ym}-01`, { month: "long" }).toLowerCase();

  const publicUrl = `${appUrl()}/${ctx.org.slug}`;
  const checklist = [
    { done: svcCount.n > 0, label: "Cadastrar serviços com preço e duração", href: "/painel/servicos" },
    { done: hoursCount.n > 0, label: "Conferir horários de atendimento", href: "/painel/horarios" },
    { done: !!orgRow.address && !!orgRow.phone, label: "Completar endereço e contato", href: "/painel/configuracoes/empresa" },
    { done: orgRow.description.length > 0, label: "Escrever a descrição da página", href: "/painel/configuracoes/empresa" },
    { done: orgRow.onlineBookingEnabled, label: "Ativar o agendamento online", href: "/painel/configuracoes/agendamento" },
    { done: apptCount.n > 0, label: "Receber o primeiro agendamento", href: "/painel/agenda" },
  ];
  const pendingSteps = checklist.filter((c) => !c.done).length;

  const ApptRow = ({ a, client }: { a: typeof schema.appointments.$inferSelect; client: string }) => (
    <Link href={`/painel/agendamentos/${a.id}`} className="flex items-stretch gap-3 py-2.5">
      <span className="w-1 shrink-0 rounded-full bg-berry/60" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate">{client}</span>
          {showMoney && <span className="shrink-0 font-semibold tnum">{fmtMoney(a.priceCents - a.discountCents)}</span>}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted">
          <span className="flex items-center gap-1.5 tnum">
            <Clock size={12} /> {fmtDate(a.startsAt, tz, { day: "2-digit", month: "2-digit" })} · {fmtTime(a.startsAt, tz)} → {fmtTime(a.endsAt, tz)}
            {a.source === "online" && <Globe size={12} aria-label="pelo site" />}
          </span>
          <StatusBadge status={a.status} />
        </span>
      </span>
    </Link>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {ctx.can("settings.manage") && pendingSteps > 0 && (
        <DashSection title="Deixe sua agenda pronta" aside={`${checklist.length - pendingSteps}/${checklist.length}`}>
          <ul className="grid gap-1 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5 text-sm hover:bg-paper-2">
                  {c.done ? <CheckCircle2 size={19} className="text-ok" /> : <Circle size={19} className="text-line-2" />}
                  <span className={c.done ? "text-muted line-through" : ""}>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 rounded-xl bg-paper-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="truncate text-sm text-ink-2">{publicUrl}</span>
            <CopyLink url={publicUrl} />
          </div>
        </DashSection>
      )}

      <DashSection title="Agendamentos pendentes" aside={pending.length ? String(pending.length) : undefined}>
        {pending.length === 0 ? <p className="py-2 text-sm text-muted">Nenhum agendamento aguardando confirmação.</p> : (
          <div className="divide-y divide-line">{pending.map((p) => <ApptRow key={p.a.id} {...p} />)}</div>
        )}
      </DashSection>

      {showMoney && (
        <>
          <DashSection title="Faturamento anual">
            <LineChart data={yearSeries} />
          </DashSection>
          <DashSection title="Faturamento semanal">
            <BarChart data={weekSeries} />
          </DashSection>
        </>
      )}

      <DashSection title="Clientes atendidas há +14 dias" hint="Não voltaram nem têm horário marcado. Bom momento para chamar para a manutenção.">
        {away.length === 0 ? <p className="py-2 text-sm text-muted">Ninguém por aqui ainda.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1.5 font-medium">Cliente</th><th className="py-1.5 text-right font-medium">Atendimento</th></tr></thead>
            <tbody>
              {away.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-2"><Link href={`/painel/clientes/${c.id}`} className="hover:text-berry">{c.name}</Link></td>
                  <td className="py-2 text-right tnum">{fmtDate(new Date(c.last), tz)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DashSection>

      {showMoney && (
        <>
          <DashSection title="Top serviços">
            <Pivot rows={topSvc} months={threeMonths} label="Serviço" monthLabel={monthLabel} />
          </DashSection>
          <DashSection title="Top clientes">
            <Pivot rows={topCli} months={threeMonths} label="Cliente" monthLabel={monthLabel} />
          </DashSection>
        </>
      )}

      <DashSection title="Últimos agendamentos">
        {latest.length === 0 ? <p className="py-2 text-sm text-muted">Nenhum agendamento ainda.</p> : (
          <div className="divide-y divide-line">{latest.map((p) => <ApptRow key={p.a.id} {...p} />)}</div>
        )}
      </DashSection>

      <Fab href="/painel/agenda?novo=1" label="Novo agendamento" />
    </div>
  );
}

function Pivot({ rows, months, label, monthLabel }: {
  rows: { name: string; byMonth: Record<string, number> }[];
  months: string[];
  label: string;
  monthLabel: (ym: string) => string;
}) {
  if (rows.length === 0) return <p className="py-2 text-sm text-muted">Sem dados nos últimos 3 meses.</p>;
  return (
    <div className="scroll-thin -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-1.5 text-left font-medium">{label}</th>
            {months.map((m) => <th key={m} className="py-1.5 pl-3 text-right font-medium">{monthLabel(m)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-line">
              <td className="max-w-[200px] truncate py-2">{r.name}</td>
              {months.map((m) => <td key={m} className="py-2 pl-3 text-right tnum">{fmtMoney(r.byMonth[m] ?? 0)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
