import Link from "next/link";
import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { Plus, Search } from "lucide-react";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { formatPhone, maskPhone } from "@/lib/security";
import { fmtDate } from "@/lib/time";
import { Alert, ButtonLink, Card, EmptyState, Input, PageHeader } from "@/components/ui";

export const metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; anonimizada?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const digits = q.replace(/\D/g, "");
  const rows = await db
    .select({
      id: schema.clients.id, name: schema.clients.name, phone: schema.clients.phone, email: schema.clients.email,
      visits: sql<number>`(select count(*)::int from appointments a where a.client_id = ${schema.clients.id} and a.status = 'completed')`,
      last: sql<Date | null>`(select max(a.starts_at) from appointments a where a.client_id = ${schema.clients.id} and a.status in ('completed','confirmed','pending'))`,
    })
    .from(schema.clients)
    .where(and(
      eq(schema.clients.organizationId, ctx.org.id),
      isNull(schema.clients.anonymizedAt),
      q ? or(ilike(schema.clients.name, `%${q}%`), digits.length >= 3 ? ilike(schema.clients.phoneNormalized, `%${digits}%`) : undefined, ilike(schema.clients.email, `%${q}%`)) : undefined,
    ))
    .orderBy(asc(schema.clients.name))
    .limit(200);
  const showPhone = ctx.can("clients.view_phone");

  return (
    <>
      <PageHeader title="Clientes" subtitle={`${rows.length}${rows.length === 200 ? "+" : ""} ${q ? "encontradas" : "cadastradas"}`}
        actions={ctx.can("clients.manage") && <ButtonLink href="/painel/clientes/nova"><Plus size={18} /> Nova cliente</ButtonLink>} />
      {sp.anonimizada && <div className="mb-4"><Alert tone="ok">Os dados pessoais da cliente foram removidos.</Alert></div>}
      <form className="relative mb-5 max-w-md">
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <Input name="q" defaultValue={q} placeholder="Buscar por nome, telefone ou e-mail" className="pl-10" />
      </form>
      {rows.length === 0 ? (
        <EmptyState title={q ? "Nenhuma cliente encontrada" : "Nenhuma cliente ainda"}>
          {q ? "Tente outro nome ou parte do telefone." : "As clientes que agendarem pelo seu link aparecem aqui automaticamente."}
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line">
          {rows.map((c) => (
            <Link key={c.id} href={`/painel/clientes/${c.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-paper-2/60">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-berry-soft font-display text-berry">{c.name.charAt(0).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="block truncate text-sm text-muted">{showPhone ? formatPhone(c.phone) : maskPhone(c.phone)}{c.email && ` · ${c.email}`}</span>
              </span>
              <span className="hidden text-right text-xs text-muted sm:block">
                {c.visits} atendimento{c.visits === 1 ? "" : "s"}
                {c.last && <span className="block">último: {fmtDate(new Date(c.last), ctx.org.timezone)}</span>}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
