import Link from "next/link";
import { and, asc, count, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { ChevronRight, MessageCircle, Search, UserPlus } from "lucide-react";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { whatsappLink } from "@/lib/security";
import { fmtDate } from "@/lib/time";
import { Avatar, Group, btn, inputCls } from "@/components/app";

export const metadata = { title: "Clientes" };

const PAGE = 60;

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; mostrar?: string; anonimizada?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const tz = ctx.org.timezone;
  const q = (sp.q ?? "").trim();
  const digits = q.replace(/\D/g, "");
  const limit = Math.min(Math.max(Number(sp.mostrar) || PAGE, PAGE), 3000);
  const where = and(
    eq(schema.clients.organizationId, ctx.org.id),
    isNull(schema.clients.anonymizedAt),
    q ? or(ilike(schema.clients.name, `%${q}%`), digits.length >= 3 ? ilike(schema.clients.phoneNormalized, `%${digits}%`) : undefined) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id: schema.clients.id,
      name: schema.clients.name,
      phone: schema.clients.phone,
      visits: sql<number>`(select count(*)::int from appointments a where a.client_id = "clients"."id" and a.status = 'completed')`,
      last: sql<string | null>`(select max(a.starts_at) from appointments a where a.client_id = "clients"."id" and a.status = 'completed')`,
      next: sql<string | null>`(select min(a.starts_at) from appointments a where a.client_id = "clients"."id" and a.status in ('confirmed','pending') and a.starts_at > now())`,
    }).from(schema.clients).where(where).orderBy(asc(schema.clients.name)).limit(limit),
    db.select({ total: count() }).from(schema.clients).where(where),
  ]);
  const showPhone = ctx.can("clients.view_phone");

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-[28px] font-bold leading-tight">Clientes</h1>
        {ctx.can("clients.manage") && (
          <Link href="/painel/clientes/nova" className={btn.mini}><UserPlus size={15} /> Nova cliente</Link>
        )}
      </div>
      {sp.anonimizada === "1" && <p className="mt-3 rounded-2xl bg-ok-soft px-4 py-3 text-[14px] text-ok">Os dados da cliente foram anonimizados.</p>}

      <form className="relative mt-4" role="search">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input name="q" defaultValue={q} placeholder="Buscar por nome ou WhatsApp" className={inputCls + " pl-11"} aria-label="Buscar cliente" />
      </form>

      <p className="mt-3 mb-3 text-[13px] text-muted">
        {q ? `${total} encontrada${total === 1 ? "" : "s"} para “${q}”` : `${total} cliente${total === 1 ? "" : "s"}`}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-line-2 px-5 py-8 text-center text-[14px] text-muted">
          {q ? "Ninguém com esse nome ou número." : "As clientes aparecem aqui quando você faz o primeiro agendamento."}
        </div>
      ) : (
        <Group>
          {rows.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/painel/clientes/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={c.name} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{c.name}</p>
                  <p className="truncate text-[13px] text-muted">
                    {c.visits
                      ? `${c.visits} atendimento${c.visits > 1 ? "s" : ""}, último em ${fmtDate(new Date(c.last!), tz, { day: "2-digit", month: "2-digit", year: "2-digit" })}`
                      : "Ainda sem atendimentos concluídos"}
                  </p>
                  {c.next && <p className="truncate text-[13px] font-semibold text-gel-ink">Volta em {fmtDate(new Date(c.next), tz, { day: "2-digit", month: "2-digit" })}</p>}
                </div>
              </Link>
              {showPhone && c.phone && (
                <a href={whatsappLink(c.phone)} target="_blank" rel="noopener" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line-2" aria-label={`WhatsApp de ${c.name}`}>
                  <MessageCircle size={17} />
                </a>
              )}
              <ChevronRight size={16} className="shrink-0 text-muted" />
            </div>
          ))}
        </Group>
      )}
      {total > rows.length && (
        <div className="mt-4 flex justify-center">
          <Link className={btn.mini} href={`/painel/clientes?${new URLSearchParams({ ...(q ? { q } : {}), mostrar: String(limit + PAGE) })}`}>Mostrar mais</Link>
        </div>
      )}
    </div>
  );
}
