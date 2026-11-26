import Link from "next/link";
import { and, asc, count, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { Search } from "lucide-react";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { formatPhone, maskPhone } from "@/lib/security";
import { fmtDate } from "@/lib/time";
import { Alert, EmptyState, Input } from "@/components/ui";
import { Fab } from "../nav";
import { ClientCard } from "./client-card";

export const metadata = { title: "Clientes" };

const PAGE = 50;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; anonimizada?: string; mostrar?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const tz = ctx.org.timezone;
  const q = (sp.q ?? "").trim();
  const digits = q.replace(/\D/g, "");
  const limit = Math.min(Math.max(Number(sp.mostrar) || PAGE, PAGE), 2000);
  const where = and(
    eq(schema.clients.organizationId, ctx.org.id),
    isNull(schema.clients.anonymizedAt),
    q ? or(ilike(schema.clients.name, `%${q}%`), digits.length >= 3 ? ilike(schema.clients.phoneNormalized, `%${digits}%`) : undefined, ilike(schema.clients.email, `%${q}%`)) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id: schema.clients.id, name: schema.clients.name, phone: schema.clients.phone, email: schema.clients.email,
      birthDate: schema.clients.birthDate, notes: schema.clients.notes,
      visits: sql<number>`(select count(*)::int from appointments a where a.client_id = ${schema.clients.id} and a.status = 'completed')`,
      spent: sql<number>`(select coalesce(sum(a.price_cents - a.discount_cents),0)::int from appointments a where a.client_id = ${schema.clients.id} and a.status = 'completed')`,
      last: sql<Date | null>`(select max(a.starts_at) from appointments a where a.client_id = ${schema.clients.id} and a.status in ('completed','confirmed','pending') and a.starts_at <= now())`,
      next: sql<Date | null>`(select min(a.starts_at) from appointments a where a.client_id = ${schema.clients.id} and a.status in ('confirmed','pending') and a.starts_at > now())`,
    }).from(schema.clients).where(where).orderBy(asc(schema.clients.name)).limit(limit),
    db.select({ total: count() }).from(schema.clients).where(where),
  ]);
  const showPhone = ctx.can("clients.view_phone");
  const fmtD = (d: Date | string | null) => (d ? fmtDate(new Date(d), tz) : "");

  return (
    <div className="mx-auto max-w-2xl">
      {sp.anonimizada && <div className="mb-3"><Alert tone="ok">Os dados pessoais da cliente foram removidos.</Alert></div>}
      <form className="relative mb-3">
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <Input name="q" defaultValue={q} placeholder="Pesquise por clientes…" className="rounded-full pl-10" />
      </form>

      {rows.length === 0 ? (
        <EmptyState title={q ? "Nenhuma cliente encontrada" : "Nenhuma cliente ainda"}>
          {q ? "Tente outro nome ou parte do telefone." : "As clientes que agendarem pelo seu link aparecem aqui automaticamente."}
        </EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((c) => (
            <li key={c.id}>
              <ClientCard
                id={c.id}
                name={c.name}
                phone={showPhone ? formatPhone(c.phone) : maskPhone(c.phone)}
                rawPhone={showPhone ? c.phone : ""}
                email={c.email}
                birth={c.birthDate ? fmtDate(new Date(c.birthDate + "T12:00:00Z"), "UTC") : ""}
                notes={c.notes}
                visits={c.visits}
                spentCents={c.spent}
                last={fmtD(c.last)}
                next={fmtD(c.next)}
              />
            </li>
          ))}
        </ul>
      )}

      {rows.length < total && (
        <div className="mt-4 text-center">
          <Link href={`?${new URLSearchParams({ ...(q ? { q } : {}), mostrar: String(limit + PAGE) })}`} className="text-sm font-medium text-berry">Carregar mais</Link>
        </div>
      )}
      <p className="mt-4 text-center text-xs text-muted">Exibindo {rows.length} de {total} clientes</p>
      {ctx.can("clients.manage") && <Fab href="/painel/clientes/nova" label="Nova cliente" />}
    </div>
  );
}
