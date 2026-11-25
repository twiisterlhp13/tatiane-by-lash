"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, ChevronLeft, Clock, Link2, MessageCircle, UserRound } from "lucide-react";
import { Alert, Button, Checkbox, Field, Input, Textarea, cx } from "@/components/ui";
import { fmtDuration, fmtLocalDateLong, fmtMoney } from "@/lib/time";
import { SlotPicker, type Slot } from "./slot-picker";

type Service = { id: string; name: string; category: string; description: string; durationMinutes: number; priceCents: number; priceFrom: boolean; professionalIds: string[] };
type Pro = { id: string; name: string; bio: string; photoUrl: string | null };
type Step = "service" | "professional" | "time" | "details" | "done";
type Success = { code: string; status: string; service: string; professional: string; startsAt: string; endsAt: string; dateLabel: string; timeLabel: string; manageUrl: string | null };

function icsDate(iso: string) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function BookingWizard(props: {
  slug: string; today: string; requireEmail: boolean; policyText: string; address: string; orgName: string;
  services: Service[]; professionals: Pro[];
}) {
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);
  const [professionalId, setProfessionalId] = useState<string>("any");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slotDate, setSlotDate] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "", acceptTerms: false, marketingConsent: false, website: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);
  const [idemKey] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));

  // lembra os dados da cliente neste aparelho (só no navegador dela)
  function prefillSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem("tbl-client") || "null");
      if (saved?.name && !form.name) setForm((f) => ({ ...f, name: saved.name, phone: saved.phone ?? "", email: saved.email ?? "" }));
    } catch {}
  }
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  const categories = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const s of props.services) {
      const k = s.category || "Serviços";
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()];
  }, [props.services]);

  const prosForService = service ? props.professionals.filter((p) => service.professionalIds.includes(p.id)) : [];
  const chosenPro = props.professionals.find((p) => p.id === professionalId);

  function pickService(s: Service) {
    setService(s);
    setSlot(null);
    const pros = props.professionals.filter((p) => s.professionalIds.includes(p.id));
    if (pros.length <= 1) { setProfessionalId(pros[0]?.id ?? "any"); setStep("time"); }
    else { setProfessionalId("any"); setStep("professional"); }
  }

  async function submit() {
    if (!service || !slot) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/${props.slug}/agendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          professionalId: professionalId === "any" ? "any" : professionalId,
          startsAt: slot.start,
          ...form,
          idempotencyKey: idemKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Não foi possível agendar.");
        if (res.status === 409) { setSlot(null); setStep("time"); }
        return;
      }
      try { localStorage.setItem("tbl-client", JSON.stringify({ name: form.name, phone: form.phone, email: form.email })); } catch {}
      setSuccess(json);
      setStep("done");
    } catch {
      setError("Sem conexão. Verifique sua internet e tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done" && success) {
    const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${success.service} – ${props.orgName}`)}&dates=${icsDate(success.startsAt)}/${icsDate(success.endsAt)}&location=${encodeURIComponent(props.address)}&details=${encodeURIComponent(success.manageUrl ? `Gerenciar: ${success.manageUrl}` : `Código ${success.code}`)}`;
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Agenda//PT-BR", "BEGIN:VEVENT",
      `UID:${success.code}@agenda`, `DTSTAMP:${icsDate(new Date().toISOString())}`, `DTSTART:${icsDate(success.startsAt)}`, `DTEND:${icsDate(success.endsAt)}`,
      `SUMMARY:${success.service} – ${props.orgName}`, `LOCATION:${props.address}`, `DESCRIPTION:Código ${success.code}`, "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    return (
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex size-14 items-center justify-center rounded-full bg-ok-soft text-ok"><Check size={28} /></div>
        <h2 className="mt-4 font-display text-3xl">{success.status === "confirmed" ? "Horário confirmado!" : "Pedido enviado!"}</h2>
        <p className="mt-1 text-ink-2">
          {success.status === "confirmed" ? "Está tudo certo. Te esperamos!" : "Vamos confirmar seu horário em breve."}
          {form.email ? " Enviamos os detalhes para o seu e-mail." : ""}
        </p>
        <dl className="mt-6 grid gap-3 rounded-2xl bg-paper-2/70 p-5 text-[15px]">
          <div className="flex justify-between gap-3"><dt className="text-muted">Serviço</dt><dd className="text-right font-medium">{success.service}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Com</dt><dd className="text-right">{success.professional}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Quando</dt><dd className="text-right font-medium">{success.dateLabel}, {success.timeLabel}</dd></div>
          {props.address && <div className="flex justify-between gap-3"><dt className="text-muted">Onde</dt><dd className="text-right">{props.address}</dd></div>}
          <div className="flex justify-between gap-3"><dt className="text-muted">Código</dt><dd className="font-mono font-medium tracking-wider">{success.code}</dd></div>
        </dl>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <a href={gcal} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line-2 bg-white px-5 text-[15px] font-medium hover:border-berry">
            <CalendarPlus size={17} /> Google Agenda
          </a>
          <a href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download={`agendamento-${success.code}.ics`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line-2 bg-white px-5 text-[15px] font-medium hover:border-berry">
            <CalendarPlus size={17} /> Outro calendário
          </a>
        </div>
        {success.manageUrl && (
          <div className="mt-6 rounded-2xl border border-berry/20 bg-berry-soft/50 p-4 text-sm">
            <p className="font-medium text-ink">Guarde o link do seu agendamento</p>
            <p className="mt-1 text-ink-2">Por ele você consulta, cancela ou reagenda. Ele é pessoal, não compartilhe.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={success.manageUrl} className="inline-flex items-center gap-1.5 font-medium text-berry underline"><Link2 size={15} /> Abrir meu agendamento</a>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Meu horário em ${props.orgName}: ${success.dateLabel}, ${success.timeLabel}. ${success.manageUrl}`)}`} target="_blank" rel="noopener"
                className="inline-flex items-center gap-1.5 font-medium text-ok underline"><MessageCircle size={15} /> Salvar no meu WhatsApp</a>
            </div>
          </div>
        )}
      </div>
    );
  }

  const stepIndex = { service: 1, professional: 2, time: 3, details: 4, done: 5 }[step];
  const back = () => {
    setError("");
    if (step === "professional") setStep("service");
    else if (step === "time") setStep(prosForService.length > 1 ? "professional" : "service");
    else if (step === "details") setStep("time");
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        {step !== "service" && (
          <button onClick={back} aria-label="Voltar" className="-ml-2 rounded-full p-2 text-ink-2 hover:bg-paper-2"><ChevronLeft size={22} /></button>
        )}
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-berry">Passo {Math.min(stepIndex, 4)} de 4</p>
          <h2 className="font-display text-2xl sm:text-3xl">
            {step === "service" && "Escolha o serviço"}
            {step === "professional" && "Com quem?"}
            {step === "time" && "Escolha o dia e o horário"}
            {step === "details" && "Seus dados"}
          </h2>
        </div>
      </div>

      {service && step !== "service" && (
        <div className="mb-5 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
          <p className="font-medium">{service.name}</p>
          <p className="text-muted">
            {fmtDuration(service.durationMinutes)} · {service.priceFrom ? "a partir de " : ""}{fmtMoney(service.priceCents)}
            {step !== "professional" && prosForService.length > 1 && ` · ${chosenPro?.name ?? "qualquer profissional"}`}
            {slot && step === "details" && <span > · {fmtLocalDateLong(slotDate)}, {slot.time}</span>}
          </p>
        </div>
      )}

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {step === "service" && (
        <div className="space-y-7">
          {categories.map(([cat, list]) => (
            <section key={cat}>
              {categories.length > 1 && <h3 className="mb-2.5 text-xs font-medium uppercase tracking-[0.16em] text-muted">{cat}</h3>}
              <ul className="space-y-2.5">
                {list.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => pickService(s)}
                      className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-white px-4 py-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-berry">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-[16px] group-hover:text-berry">{s.name}</span>
                        {s.description && <span className="mt-0.5 block text-sm text-muted">{s.description}</span>}
                        <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-ink-2"><Clock size={13} /> {fmtDuration(s.durationMinutes)}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        {s.priceFrom && <span className="block text-[11px] text-muted">a partir de</span>}
                        <span className="font-display text-lg tnum">{fmtMoney(s.priceCents)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {step === "professional" && (
        <ul className="space-y-2.5">
          {[{ id: "any", name: "Sem preferência", bio: "Mostra todos os horários disponíveis", photoUrl: null }, ...prosForService].map((p) => (
            <li key={p.id}>
              <button onClick={() => { setProfessionalId(p.id); setSlot(null); setStep("time"); }}
                className="flex w-full items-center gap-4 rounded-2xl border border-line bg-white px-4 py-4 text-left shadow-[var(--shadow-soft)] hover:border-berry">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt="" className="size-12 rounded-full object-cover" />
                ) : (
                  <span className="flex size-12 items-center justify-center rounded-full bg-berry-soft text-berry"><UserRound size={22} /></span>
                )}
                <span>
                  <span className="block font-medium">{p.name}</span>
                  {p.bio && <span className="text-sm text-muted">{p.bio}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {step === "time" && service && (
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-soft)] sm:p-6">
          <SlotPicker
            slug={props.slug}
            serviceId={service.id}
            professionalId={professionalId}
            today={props.today}
            value={slot}
            onPick={(s, d) => { setSlot(s); setSlotDate(d); setError(""); prefillSaved(); setStep("details"); }}
          />
        </div>
      )}

      {step === "details" && (
        <form className="space-y-4 rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7"
          onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Field label="Nome completo"><Input autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="WhatsApp" hint="Com DDD. Usamos só para falar sobre o seu horário.">
            <Input type="tel" inputMode="tel" autoComplete="tel" required placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label={props.requireEmail ? "E-mail" : "E-mail (opcional)"} hint="Para receber a confirmação e o lembrete.">
            <Input type="email" autoComplete="email" required={props.requireEmail} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Alguma observação? (opcional)">
            <Textarea rows={2} maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex.: primeira vez, tenho olhos sensíveis…" />
          </Field>
          {/* campo invisível contra robôs */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="hidden" aria-hidden />
          {props.policyText && (
            <div className="rounded-xl bg-paper-2 px-4 py-3 text-sm text-ink-2"><p className="mb-1 font-medium text-ink">Política</p>{props.policyText}</div>
          )}
          <Checkbox required checked={form.acceptTerms} onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
            label={<>Li e aceito os <Link href="/termos" target="_blank" className="text-berry underline">termos de uso</Link> e a <Link href="/privacidade" target="_blank" className="text-berry underline">política de privacidade</Link>.</>} />
          <Checkbox checked={form.marketingConsent} onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })}
            label="Quero receber novidades e promoções (opcional)." />
          <Button type="submit" className={cx("w-full text-base")} disabled={submitting || !form.acceptTerms}>
            {submitting ? "Confirmando…" : "Confirmar agendamento"}
          </Button>
        </form>
      )}
    </div>
  );
}
