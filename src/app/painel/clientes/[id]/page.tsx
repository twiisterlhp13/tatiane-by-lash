import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ChevronLeft, Download, MessageCircle } from "lucide-react";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { formatPhone, maskPhone, whatsappLink } from "@/lib/security";
import { fmtDate, fmtMoney, fmtTime } from "@/lib/time";
import { ButtonLink, Card, PageHeader, StatusBadge } from "@/components/ui";
import { ClientForm } from "../client-form";
import { anonymizeClientAction, updateClientAction } from "../actions";
import { ConfirmButton } from "./confirm-button";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [c] = await db.select().from(schema.clients).where(and(eq(schema.clients.id, id), eq(schema.clients.organizationId, ctx.org.id))).limit(1);
  if (!c || c.anonymizedAt) notFound();
  const tz = ctx.org.timezone;
  const history = await db.select().from(schema.appointments)
    .where(and(eq(schema.appointments.clientId, c.id), eq(schema.appointments.organizationId, ctx.org.id), ctx.can("agenda.view_all") ? undefined : eq(schema.appointments.professionalId, ctx.professionalId ?? "")))
    .orderBy(desc(schema.appointments.startsAt)).limit(100);
  const completed = history.filter((h) => h.status === "completed");
  const spent = completed.reduce((s, h) => s + h.priceCents - h.discountCents, 0);
  const noShows = history.filter((h) => h.status === "no_show").length;
  const showPhone = ctx.can("clients.view_phone");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/painel/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Clientes</Link>
      <PageHeader
        title={c.name}
        subtitle={`Cliente desde ${fmtDate(c.createdAt, tz, { month: "long", year: "numeric" })}`}
        actions={
          <>
            {showPhone && c.phone && (
              <ButtonLink variant="secondary" href={whatsappLink(c.phone)} target="_blank"><MessageCircle size={17} /> WhatsApp</ButtonLink>
            )}
            <ButtonLink href={`/painel/agenda?novo=1`}>Agendar</ButtonLink>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[["Atendimentos", String(completed.length)], ["Total gasto", fmtMoney(spent)], ["Faltas", String(noShows)]].map(([l, v]) => (
          <Card key={l} className="p-4"><p className="text-xs uppercase tracking-wider text-muted">{l}</p><p className="mt-1 font-display text-2xl tnum">{v}</p></Card>
        ))}
      </div>

      <Card className="mb-6 p-5 sm:p-7">
        <h2 className="mb-4 font-display text-xl">Dados</h2>
        {!showPhone && <p className="mb-3 text-sm text-muted">Telefone: {maskPhone(c.phone)}</p>}
        <ClientForm
          action={updateClientAction.bind(null, c.id)}
          readOnly={!ctx.can("clients.manage")}
          submitLabel="Salvar alterações"
          values={{ name: c.name, phone: showPhone ? formatPhone(c.phone) : "", email: c.email, birthDate: c.birthDate ?? "", notes: c.notes, marketingConsent: c.marketingConsent }}
        />
        <p className="mt-4 text-xs text-muted">
          Termos aceitos: {c.termsAcceptedAt ? fmtDate(c.termsAcceptedAt, tz) : "não registrado (cadastro pelo painel)"} ·
          Promoções: {c.marketingConsent ? `autorizado em ${c.marketingConsentAt ? fmtDate(c.marketingConsentAt, tz) : "—"}` : "não autorizado"}
        </p>
      </Card>

      <Card className="mb-6 p-5 sm:p-7">
        <h2 className="mb-4 font-display text-xl">Histórico de atendimentos</h2>
        {history.length === 0 ? <p className="text-sm text-muted">Nenhum agendamento ainda.</p> : (
          <ul className="divide-y divide-line">
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/painel/agendamentos/${h.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-paper-2/50">
                  <span>
                    <span className="block font-medium">{h.serviceName}</span>
                    <span className="text-sm text-muted">{fmtDate(h.startsAt, tz)} às {fmtTime(h.startsAt, tz)} · {fmtMoney(h.priceCents - h.discountCents)}</span>
                  </span>
                  <StatusBadge status={h.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {ctx.can("clients.privacy") && (
        <Card className="p-5 sm:p-7">
          <h2 className="font-display text-xl">Privacidade (LGPD)</h2>
          <p className="mt-1 text-sm text-muted">Atenda pedidos da cliente de acesso ou exclusão dos dados pessoais.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink variant="secondary" href={`/api/painel/clientes/${c.id}/exportar`} prefetch={false}><Download size={16} /> Exportar dados (JSON)</ButtonLink>
            <ConfirmButton
              action={anonymizeClientAction.bind(null, c.id)}
              label="Excluir dados pessoais"
              confirm="Isso remove nome, telefone, e-mail e observações desta cliente de forma permanente. O histórico de atendimentos fica anônimo para os relatórios. Continuar?"
            />
          </div>
        </Card>
      )}
    </div>
  );
}
