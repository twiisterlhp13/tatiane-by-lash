import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { fmtDate, fmtLongDate, fmtMoney, fmtTime, toLocalDate } from "@/lib/time";
import { formatPhone, maskPhone, whatsappLink } from "@/lib/security";
import { Card, StatusBadge, STATUS_LABEL } from "@/components/ui";
import { AppointmentActions } from "./appointment-actions";

const ACTION_LABEL: Record<string, string> = {
  created: "Agendamento criado",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Marcado como falta",
  rescheduled: "Reagendado",
  updated: "Valores ou observações alterados",
  reopened: "Voltou para pendente",
  reminder: "Lembrete enviado",
};
const PAYMENT_LABEL: Record<string, string> = { pix: "Pix", cartao_credito: "Cartão de crédito", cartao_debito: "Cartão de débito", dinheiro: "Dinheiro", outro: "Outro", "": "—" };

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const tz = ctx.org.timezone;
  const [row] = await db
    .select({ a: schema.appointments, client: schema.clients, prof: schema.professionals })
    .from(schema.appointments)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.appointments.clientId))
    .innerJoin(schema.professionals, eq(schema.professionals.id, schema.appointments.professionalId))
    .where(and(eq(schema.appointments.id, id), eq(schema.appointments.organizationId, ctx.org.id)))
    .limit(1);
  if (!row) notFound();
  const { a, client, prof } = row;
  const canManage = ctx.can("agenda.manage_all") || (ctx.can("agenda.manage_own") && a.professionalId === ctx.professionalId);
  if (!ctx.can("agenda.view_all") && a.professionalId !== ctx.professionalId) notFound();

  const [events, notes, professionals] = await Promise.all([
    db.select().from(schema.appointmentEvents).where(eq(schema.appointmentEvents.appointmentId, a.id)).orderBy(desc(schema.appointmentEvents.createdAt)),
    db.select().from(schema.notifications).where(eq(schema.notifications.appointmentId, a.id)).orderBy(desc(schema.notifications.createdAt)).limit(10),
    db.select({ id: schema.professionals.id, name: schema.professionals.name }).from(schema.professionals)
      .innerJoin(schema.professionalServices, eq(schema.professionalServices.professionalId, schema.professionals.id))
      .where(and(eq(schema.professionals.organizationId, ctx.org.id), eq(schema.professionalServices.serviceId, a.serviceId), eq(schema.professionals.active, true)))
      .orderBy(asc(schema.professionals.name)),
  ]);
  const phone = ctx.can("clients.view_phone") ? formatPhone(client.phone) : maskPhone(client.phone);
  const total = a.priceCents - a.discountCents;
  const waText = `Olá, ${client.name.split(" ")[0]}! Aqui é da ${ctx.org.name}. Sobre seu horário de ${a.serviceName} em ${fmtDate(a.startsAt, tz, { day: "2-digit", month: "2-digit" })} às ${fmtTime(a.startsAt, tz)}:`;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/painel/agenda?data=${toLocalDate(a.startsAt, tz)}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Agenda</Link>
      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Código {a.code} · {a.source === "online" ? "agendado pelo site" : "criado no painel"}</p>
            <h1 className="mt-1 font-display text-3xl">{fmtLongDate(a.startsAt, tz)}</h1>
            <p className="mt-1 text-lg tnum">{fmtTime(a.startsAt, tz)} – {fmtTime(a.endsAt, tz)}</p>
          </div>
          <StatusBadge status={a.status} />
        </div>

        <div className="mt-6 grid gap-5 border-t border-line pt-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Cliente</p>
            <Link href={`/painel/clientes/${client.id}`} className="mt-1 block text-lg font-medium text-berry hover:underline">{client.name}</Link>
            <p className="text-sm text-ink-2">{phone}</p>
            {client.email && <p className="text-sm text-ink-2">{client.email}</p>}
            {ctx.can("clients.view_phone") && client.phone && (
              <a href={whatsappLink(client.phone, waText)} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-ok">
                <MessageCircle size={16} /> Conversar no WhatsApp
              </a>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Serviço</p>
            <p className="mt-1 text-lg font-medium">{a.serviceName}</p>
            <p className="text-sm text-ink-2">com {prof.name}</p>
            <p className="mt-2 text-sm tnum">
              {fmtMoney(total)}{a.discountCents > 0 && <span className="text-muted"> (desconto de {fmtMoney(a.discountCents)})</span>}
              <span className="block text-muted">Pago: {fmtMoney(a.paidCents)} · {PAYMENT_LABEL[a.paymentMethod] ?? a.paymentMethod}</span>
            </p>
          </div>
        </div>

        {a.clientNotes && (
          <div className="mt-5 rounded-xl bg-paper-2 px-4 py-3 text-sm"><span className="font-medium">Observação da cliente:</span> {a.clientNotes}</div>
        )}
        {a.cancelReason && (
          <div className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger"><span className="font-medium">Motivo do cancelamento:</span> {a.cancelReason}</div>
        )}

        {canManage && (
          <AppointmentActions
            appointment={{
              id: a.id, status: a.status, date: toLocalDate(a.startsAt, tz), time: fmtTime(a.startsAt, tz), professionalId: a.professionalId,
              priceCents: a.priceCents, discountCents: a.discountCents, paidCents: a.paidCents, paymentMethod: a.paymentMethod, internalNotes: a.internalNotes,
              hasEmail: !!client.email,
            }}
            professionals={professionals}
          />
        )}
      </Card>

      <Card className="mt-6 p-5 sm:p-7">
        <h2 className="font-display text-xl">Histórico</h2>
        <ol className="mt-4 space-y-3">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-berry/60" />
              <div>
                <p>
                  <span className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</span>
                  {e.toStatus && e.action !== "created" && e.action !== "rescheduled" && <span className="text-muted"> → {STATUS_LABEL[e.toStatus] ?? e.toStatus}</span>}
                  {e.action === "rescheduled" && typeof e.data?.from === "object" && e.data.from && (
                    <span className="text-muted"> · antes: {fmtDate(new Date((e.data.from as { startsAt: string }).startsAt), tz, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {fmtDate(e.createdAt, tz, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {e.actorType === "client" ? "pela cliente" : e.actorType === "system" ? "automático" : e.actorLabel} {e.source === "online" ? "(site)" : e.source === "panel" ? "(painel)" : ""}
                  {e.reason && ` · motivo: ${e.reason}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
        {notes.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-medium text-ink-2">Mensagens</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {notes.map((n) => (
                <li key={n.id}>{fmtDate(n.createdAt, tz, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {n.subject || n.templateKey} · {n.recipient || "sem destinatário"} · {n.status === "simulated" ? "simulado (e-mail não configurado)" : n.status}</li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
