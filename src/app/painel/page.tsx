import Link from "next/link";
import { and, asc, count, eq, gte, lt } from "drizzle-orm";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { addDays, fmtLongDate, fmtMoney, fmtTime, localToUtc, toLocalDate, weekdayOf, windowsForDateSafe } from "./panel-helpers";
import { appUrl } from "@/lib/notify";
import { ButtonLink, Card, PageHeader, StatusBadge } from "@/components/ui";
import { CopyLink } from "./copy-link";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ "bem-vinda"?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const tz = ctx.org.timezone;
  const today = toLocalDate(new Date(), tz);
  const dayStart = localToUtc(today, 0, tz);
  const dayEnd = localToUtc(addDays(today, 1), 0, tz);
  const weekStartDate = addDays(today, -((weekdayOf(today) + 6) % 7)); // segunda-feira
  const weekStart = localToUtc(weekStartDate, 0, tz);
  const weekEnd = localToUtc(addDays(weekStartDate, 7), 0, tz);

  const ownOnly = !ctx.can("agenda.view_all");
  const NONE = "00000000-0000-0000-0000-000000000000";
  const scope = () => (ownOnly ? eq(schema.appointments.professionalId, ctx.professionalId ?? NONE) : undefined);
  const scopePro = () => (ownOnly ? eq(schema.professionals.id, ctx.professionalId ?? NONE) : undefined);

  const [todayList, weekRows, pending, [svcCount], professionals, hoursRows] = await Promise.all([
    db.select({ a: schema.appointments, client: schema.clients.name, prof: schema.professionals.name, color: schema.professionals.color })
      .from(schema.appointments)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.appointments.clientId))
      .innerJoin(schema.professionals, eq(schema.professionals.id, schema.appointments.professionalId))
      .where(and(eq(schema.appointments.organizationId, ctx.org.id), gte(schema.appointments.startsAt, dayStart), lt(schema.appointments.startsAt, dayEnd), scope()))
      .orderBy(asc(schema.appointments.startsAt)),
    db.select({ status: schema.appointments.status, price: schema.appointments.priceCents, discount: schema.appointments.discountCents, startsAt: schema.appointments.startsAt, endsAt: schema.appointments.endsAt })
      .from(schema.appointments)
      .where(and(eq(schema.appointments.organizationId, ctx.org.id), gte(schema.appointments.startsAt, weekStart), lt(schema.appointments.startsAt, weekEnd), scope())),
    db.select({ a: schema.appointments, client: schema.clients.name })
      .from(schema.appointments)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.appointments.clientId))
      .where(and(eq(schema.appointments.organizationId, ctx.org.id), eq(schema.appointments.status, "pending"), gte(schema.appointments.startsAt, new Date()), scope()))
      .orderBy(asc(schema.appointments.startsAt)).limit(5),
    db.select({ n: count() }).from(schema.services).where(and(eq(schema.services.organizationId, ctx.org.id), eq(schema.services.active, true))),
    db.select().from(schema.professionals).where(and(eq(schema.professionals.organizationId, ctx.org.id), eq(schema.professionals.active, true), scopePro())),
    db.select().from(schema.professionalHours).where(eq(schema.professionalHours.organizationId, ctx.org.id)),
  ]);

  const active = weekRows.filter((r) => ["pending", "confirmed", "completed"].includes(r.status));
  const revenue = active.reduce((s, r) => s + r.price - r.discount, 0);
  const bookedMin = active.reduce((s, r) => s + (r.endsAt.getTime() - r.startsAt.getTime()) / 60000, 0);
  let workMin = 0;
  for (const p of professionals) {
    for (let i = 0; i < 7; i++) {
      workMin += windowsForDateSafe(hoursRows.filter((h) => h.professionalId === p.id), addDays(weekStartDate, i));
    }
  }
  const occupancy = workMin > 0 ? Math.round((bookedMin / workMin) * 100) : 0;
  const publicUrl = `${appUrl()}/${ctx.org.slug}`;

  const [orgRow] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, ctx.org.id));
  const [apptCount] = await db.select({ n: count() }).from(schema.appointments).where(eq(schema.appointments.organizationId, ctx.org.id));
  const checklist = [
    { done: svcCount.n > 0, label: "Cadastrar serviços com preço e duração", href: "/painel/servicos" },
    { done: hoursRows.length > 0, label: "Conferir horários de atendimento", href: "/painel/horarios" },
    { done: !!orgRow.address && !!orgRow.phone, label: "Completar endereço e contato", href: "/painel/configuracoes" },
    { done: orgRow.description.length > 0, label: "Escrever a descrição da página pública", href: "/painel/configuracoes" },
    { done: orgRow.onlineBookingEnabled, label: "Ativar o agendamento online", href: "/painel/configuracoes" },
    { done: apptCount.n > 0, label: "Receber o primeiro agendamento", href: "/painel/agenda" },
  ];
  const pendingSteps = checklist.filter((c) => !c.done).length;

  return (
    <>
      <PageHeader
        title={sp["bem-vinda"] ? `Bem-vinda, ${ctx.user.name.split(" ")[0]}!` : `Olá, ${ctx.user.name.split(" ")[0]}`}
        subtitle={fmtLongDate(new Date(), tz)}
        actions={<ButtonLink href="/painel/agenda?novo=1"><Plus size={18} /> Novo agendamento</ButtonLink>}
      />

      {ctx.can("settings.manage") && pendingSteps > 0 && (
        <Card className="mb-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl">Deixe sua agenda pronta</h2>
            <span className="text-sm text-muted">{checklist.length - pendingSteps} de {checklist.length} concluídos</span>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm hover:bg-paper-2">
                  {c.done ? <CheckCircle2 size={19} className="text-ok" /> : <Circle size={19} className="text-line-2" />}
                  <span className={c.done ? "text-muted line-through" : ""}>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Seu link de agendamento</p>
          <p className="truncate text-sm text-muted">{publicUrl}</p>
          {!ctx.org.onlineBookingEnabled && <p className="mt-1 text-xs text-warn">O agendamento online está desativado. Clientes veem só a página, sem horários.</p>}
        </div>
        <CopyLink url={publicUrl} />
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Hoje", value: String(todayList.filter((t) => ["pending", "confirmed", "completed"].includes(t.a.status)).length), hint: "atendimentos" },
          { label: "Esta semana", value: String(active.length), hint: "atendimentos" },
          { label: "Receita prevista", value: fmtMoney(revenue), hint: "na semana" },
          { label: "Ocupação", value: `${occupancy}%`, hint: "da agenda na semana" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted">{s.label}</p>
            <p className="mt-1 font-display text-2xl tnum">{s.value}</p>
            <p className="text-xs text-muted">{s.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl">Agenda de hoje</h2>
            <Link href="/painel/agenda" className="text-sm text-berry hover:underline">Abrir agenda</Link>
          </div>
          {todayList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nenhum atendimento hoje.</p>
          ) : (
            <ul className="divide-y divide-line">
              {todayList.map(({ a, client, prof, color }) => (
                <li key={a.id}>
                  <Link href={`/painel/agendamentos/${a.id}`} className="flex items-center gap-3 py-3 hover:bg-paper-2/50">
                    <span className="w-14 shrink-0 font-display text-lg tnum">{fmtTime(a.startsAt, tz)}</span>
                    <span className="h-10 w-1 rounded-full" style={{ background: color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{client}</span>
                      <span className="block truncate text-sm text-muted">{a.serviceName} · {prof}</span>
                    </span>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 font-display text-xl">Aguardando confirmação</h2>
          {pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nada pendente. 🎉</p>
          ) : (
            <ul className="divide-y divide-line">
              {pending.map(({ a, client }) => (
                <li key={a.id}>
                  <Link href={`/painel/agendamentos/${a.id}`} className="block py-3">
                    <span className="block font-medium">{client}</span>
                    <span className="text-sm text-muted">{fmtLongDate(a.startsAt, tz)} · {fmtTime(a.startsAt, tz)} · {a.serviceName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

