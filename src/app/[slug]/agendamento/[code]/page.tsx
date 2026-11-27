import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { canClientChange } from "@/lib/availability";
import { getAppointmentByToken, getOrgBySlug, orgSettings } from "@/lib/booking";
import { whatsappLink } from "@/lib/security";
import { fmtLongDate, fmtTime, toLocalDate } from "@/lib/time";
import { StatusBadge } from "@/components/ui";
import { ManageActions } from "./manage-actions";
import { GuardarNoAparelho } from "./guardar";

export const metadata: Metadata = { title: "Meu agendamento", robots: { index: false, follow: false } };

export default async function ManagePage({ params, searchParams }: { params: Promise<{ slug: string; code: string }>; searchParams: Promise<{ t?: string }> }) {
  const { slug, code } = await params;
  const { t = "" } = await searchParams;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();
  if (org.slug !== slug) redirect(`/${org.slug}/agendamento/${code}${t ? `?t=${t}` : ""}`);
  const row = t ? await getAppointmentByToken(org.id, code, t) : null;
  const contact = org.whatsapp || org.phone;

  if (!row) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10 text-center">
        <h1 className="text-[28px] font-bold">Link inválido</h1>
        <p className="mt-2 text-ink-2">Este link não é mais válido. Use o link mais recente que você recebeu ou encontre seu agendamento pelo código.</p>
        <Link href={`/${org.slug}/meu-agendamento`} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-berry px-6 font-medium text-white">Encontrar meu agendamento</Link>
      </main>
    );
  }
  const { appt, prof } = row;
  const s = orgSettings(org);
  const tz = org.timezone;
  const active = appt.status === "pending" || appt.status === "confirmed";
  const now = new Date();
  const canCancel = active && canClientChange(appt.startsAt, now, s.cancelUntilHours);
  const canReschedule = active && canClientChange(appt.startsAt, now, s.rescheduleUntilHours);

  return (
    <main className="mx-auto max-w-xl px-5 py-8">
      <GuardarNoAparelho slug={org.slug} code={appt.code} token={t} />
      <Link href={`/${org.slug}?aba=meus`} className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink"><ChevronLeft size={16} /> Meus horários</Link>
      <div className="rounded-[24px] border border-line bg-white p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-muted">Código <span className="font-semibold tracking-wider text-ink">{appt.code}</span></p>
          <StatusBadge status={appt.status} />
        </div>
        <h1 className="mt-3 text-[26px] leading-tight font-bold">{fmtLongDate(appt.startsAt, tz)}</h1>
        <p className="tnum text-[20px] font-semibold">{fmtTime(appt.startsAt, tz)}</p>
        <dl className="mt-6 space-y-2 border-t border-line pt-5 text-[15px]">
          <div className="flex justify-between gap-3"><dt className="text-muted">Serviço</dt><dd className="text-right font-medium">{appt.serviceName}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Com</dt><dd>{prof.name}</dd></div>
          {org.address && <div className="flex justify-between gap-3"><dt className="text-muted">Onde</dt><dd className="text-right">{org.address}</dd></div>}
        </dl>

        {active ? (
          <ManageActions
            slug={org.slug}
            code={appt.code}
            token={t}
            appointmentId={appt.id}
            serviceId={appt.serviceId}
            professionalId={appt.professionalId}
            today={toLocalDate(now, tz)}
            canCancel={canCancel}
            canReschedule={canReschedule}
            requireReason={s.requireCancelReason}
          />
        ) : (
          <p className="mt-6 rounded-xl bg-paper-2 px-4 py-3 text-sm text-ink-2">
            Este agendamento não está mais ativo. <Link href={`/${org.slug}`} className="font-medium text-berry underline">Agendar novo horário</Link>
          </p>
        )}
        {active && (!canCancel || !canReschedule) && (
          <p className="mt-4 text-sm text-muted">
            Pela política do estabelecimento, alterações pelo site podem ser feitas até {s.cancelUntilHours}h antes do horário. Depois disso, fale com a gente.
          </p>
        )}
        {contact && (
          <a href={whatsappLink(contact, `Olá! Sobre meu agendamento ${appt.code}:`)} target="_blank" rel="noopener"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-ok"><MessageCircle size={16} /> Falar com {org.name} no WhatsApp</a>
        )}
      </div>
      {s.policyText && <p className="mt-6 whitespace-pre-line text-xs leading-relaxed text-muted">{s.policyText}</p>}
    </main>
  );
}
