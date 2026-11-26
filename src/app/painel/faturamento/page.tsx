import Link from "next/link";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { ChevronLeft, ChevronRight, Clock, Download, Globe } from "lucide-react";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { addDays, fmtLocalDateShort, fmtMoney, fmtTime, fmtDate, localToUtc, toLocalDate } from "@/lib/time";
import { EmptyState, StatusBadge, cx } from "@/components/ui";

export const metadata = { title: "Faturamento" };

const STATUSES = ["pending", "confirmed", "completed"] as const;

function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = new Date(Date.UTC(y, m, 1));
  const nextFirst = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return { first, nextFirst };
}

function shiftMonth(ym: string, d: number) {
  const [y, m] = ym.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + d, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ mes?: string; situacao?: string }> }) {
  const ctx = await requirePermission("reports.view");
  const tz = ctx.org.timezone;
  const sp = await searchParams;
  const today = toLocalDate(new Date(), tz);
  const ym = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : today.slice(0, 7);
  const filter = sp.situacao === "concluidos" ? ["completed"] : sp.situacao === "previstos" ? ["pending", "confirmed"] : [...STATUSES];
  const { first, nextFirst } = monthBounds(ym);

  const rows = await db
    .select({ a: schema.appointments, client: schema.clients.name, prof: schema.professionals.name })
    .from(schema.appointments)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.appointments.clientId))
    .innerJoin(schema.professionals, eq(schema.professionals.id, schema.appointments.professionalId))
    .where(and(
      eq(schema.appointments.organizationId, ctx.org.id),
      gte(schema.appointments.startsAt, localToUtc(first, 0, tz)),
      lt(schema.appointments.startsAt, localToUtc(nextFirst, 0, tz)),
      inArray(schema.appointments.status, filter as ("pending" | "confirmed" | "completed")[]),
    ))
    .orderBy(asc(schema.appointments.startsAt));

  const total = rows.reduce((s, r) => s + r.a.priceCents - r.a.discountCents, 0);
  const received = rows.reduce((s, r) => s + r.a.paidCents, 0);
  const label = fmtLocalDateShort(first, { month: "long", year: "numeric" });
  const tabs = [
    { key: "", label: "Todos" },
    { key: "previstos", label: "A realizar" },
    { key: "concluidos", label: "Concluídos" },
  ];
  const qs = (o: Record<string, string>) => "?" + new URLSearchParams({ mes: ym, ...(sp.situacao ? { situacao: sp.situacao } : {}), ...o }).toString();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link href={qs({ mes: shiftMonth(ym, -1) })} aria-label="Mês anterior" className="rounded-full p-2 text-ink-2 hover:bg-white"><ChevronLeft size={20} /></Link>
        <p className="text-[15px] font-medium">{label}</p>
        <Link href={qs({ mes: shiftMonth(ym, 1) })} aria-label="Próximo mês" className="rounded-full p-2 text-ink-2 hover:bg-white"><ChevronRight size={20} /></Link>
      </div>
      <div className="mb-3 flex items-center gap-2">
        {tabs.map((t) => (
          <Link key={t.key} href={"?" + new URLSearchParams({ mes: ym, ...(t.key ? { situacao: t.key } : {}) })}
            className={cx("rounded-full px-3.5 py-1.5 text-sm", (sp.situacao ?? "") === t.key ? "bg-berry text-white" : "bg-white text-ink-2 ring-1 ring-line")}>
            {t.label}
          </Link>
        ))}
        <a href={`/api/painel/faturamento?mes=${ym}${sp.situacao ? `&situacao=${sp.situacao}` : ""}`} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm text-ink-2 ring-1 ring-line" aria-label="Baixar planilha">
          <Download size={15} /> CSV
        </a>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nenhum atendimento neste período" />
      ) : (
        <ul className="space-y-2">
          {rows.map(({ a, client, prof }) => (
            <li key={a.id}>
              <Link href={`/painel/agendamentos/${a.id}`} className="flex items-stretch gap-3 rounded-xl border border-line bg-white px-3.5 py-3 shadow-[var(--shadow-soft)]">
                <span className="w-1 shrink-0 rounded-full bg-berry/70" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{client}</span>
                    <span className="shrink-0 font-semibold tnum">{fmtMoney(a.priceCents - a.discountCents)}</span>
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
                    <span className="flex items-center gap-1.5 tnum">
                      <Clock size={13} /> {fmtDate(a.startsAt, tz, { day: "2-digit", month: "2-digit" })} · {fmtTime(a.startsAt, tz)} → {fmtTime(a.endsAt, tz)}
                      {a.source === "online" && <Globe size={13} className="ml-1" aria-label="Agendado pelo site" />}
                    </span>
                    <StatusBadge status={a.status} />
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{a.serviceName}{ctx.can("agenda.view_all") ? ` · ${prof}` : ""}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* rodapé fixo com os totais do período */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-r from-berry-2 to-berry text-white shadow-[0_-4px_16px_rgb(43_29_36/0.15)] lg:left-72">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))]">
          <span className="text-center">
            <span className="block text-[11px] text-white/70">Quantidade</span>
            <span className="font-semibold tnum">{rows.length}</span>
          </span>
          <span className="text-center">
            <span className="block text-[11px] text-white/70">Recebido</span>
            <span className="font-semibold tnum">{fmtMoney(received)}</span>
          </span>
          <span className="text-center">
            <span className="block text-[11px] text-white/70">Total</span>
            <span className="font-semibold tnum">{fmtMoney(total)}</span>
          </span>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">Período: {fmtLocalDateShort(first, { day: "2-digit", month: "2-digit", year: "numeric" })} até {fmtLocalDateShort(addDays(nextFirst, -1), { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
    </div>
  );
}
