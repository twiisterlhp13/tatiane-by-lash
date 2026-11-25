"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/modal";
import { changeStatusAction, rescheduleAction, resendLinkAction, updateAppointmentAction } from "../../agenda/actions";

type Appt = {
  id: string; status: string; date: string; time: string; professionalId: string;
  priceCents: number; discountCents: number; paidCents: number; paymentMethod: string; internalNotes: string; hasEmail: boolean;
};

const toReais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const toCents = (s: string) => Math.round(Number(s.replace(/\./g, "").replace(",", ".")) * 100) || 0;

export function AppointmentActions({ appointment: a, professionals }: { appointment: Appt; professionals: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [modal, setModal] = useState<null | "cancel" | "reschedule" | "values">(null);
  const active = a.status === "pending" || a.status === "confirmed";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.ok) { setMsg({ tone: "ok", text: okText }); setModal(null); router.refresh(); }
      else setMsg({ tone: "danger", text: r.error ?? "Erro" });
    });
  }

  return (
    <div className="mt-6 border-t border-line pt-6">
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <div className="flex flex-wrap gap-2">
        {a.status === "pending" && <Button disabled={pending} onClick={() => run(() => changeStatusAction({ id: a.id, status: "confirmed" }), "Agendamento confirmado.")}>Confirmar</Button>}
        {active && <Button variant="secondary" disabled={pending} onClick={() => run(() => changeStatusAction({ id: a.id, status: "completed" }), "Marcado como concluído.")}>Concluir atendimento</Button>}
        {active && <Button variant="secondary" disabled={pending} onClick={() => setModal("reschedule")}>Reagendar</Button>}
        <Button variant="secondary" disabled={pending} onClick={() => setModal("values")}>Valores e pagamento</Button>
        {active && <Button variant="ghost" disabled={pending} onClick={() => run(() => changeStatusAction({ id: a.id, status: "no_show", notifyClient: false }), "Marcado como falta.")}>Não compareceu</Button>}
        {active && <Button variant="danger" disabled={pending} onClick={() => setModal("cancel")}>Cancelar</Button>}
        {!active && (
          <Button variant="ghost" disabled={pending} onClick={() => run(() => changeStatusAction({ id: a.id, status: "confirmed", notifyClient: false }), "Agendamento reativado.")}>
            Reativar agendamento
          </Button>
        )}
        {active && a.hasEmail && <Button variant="ghost" disabled={pending} onClick={() => run(() => resendLinkAction(a.id), "Link reenviado para a cliente.")}>Reenviar link à cliente</Button>}
      </div>

      <Modal open={modal === "cancel"} onClose={() => setModal(null)} title="Cancelar agendamento">
        <CancelForm pending={pending} hasEmail={a.hasEmail} onSubmit={(reason, notify) => run(() => changeStatusAction({ id: a.id, status: "cancelled_by_business", reason, notifyClient: notify }), "Agendamento cancelado. O horário foi liberado.")} />
      </Modal>
      <Modal open={modal === "reschedule"} onClose={() => setModal(null)} title="Reagendar">
        <RescheduleForm a={a} professionals={professionals} pending={pending} onSubmit={(v) => run(() => rescheduleAction({ id: a.id, ...v }), "Agendamento reagendado.")} />
      </Modal>
      <Modal open={modal === "values"} onClose={() => setModal(null)} title="Valores e pagamento">
        <ValuesForm a={a} pending={pending} onSubmit={(v) => run(() => updateAppointmentAction({ id: a.id, ...v }), "Valores salvos.")} />
      </Modal>
    </div>
  );
}

function CancelForm({ pending, hasEmail, onSubmit }: { pending: boolean; hasEmail: boolean; onSubmit: (reason: string, notify: boolean) => void }) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(reason, notify); }}>
      <Field label="Motivo (registrado no histórico)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></Field>
      {hasEmail && <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} label="Avisar a cliente por e-mail" />}
      <Button type="submit" variant="danger" className="w-full" disabled={pending}>{pending ? "Cancelando…" : "Confirmar cancelamento"}</Button>
    </form>
  );
}

function RescheduleForm({ a, professionals, pending, onSubmit }: {
  a: Appt; professionals: { id: string; name: string }[]; pending: boolean;
  onSubmit: (v: { date: string; time: string; professionalId: string; allowOutsideHours: boolean; notifyClient: boolean }) => void;
}) {
  const [date, setDate] = useState(a.date);
  const [time, setTime] = useState(a.time);
  const [professionalId, setProfessionalId] = useState(a.professionalId);
  const [allow, setAllow] = useState(false);
  const [notify, setNotify] = useState(true);
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ date, time, professionalId, allowOutsideHours: allow, notifyClient: notify }); }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nova data"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Novo horário"><Input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} required /></Field>
      </div>
      {professionals.length > 1 && (
        <Field label="Profissional">
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      )}
      <Checkbox checked={allow} onChange={(e) => setAllow(e.target.checked)} label="Permitir fora do horário de trabalho (encaixe)" />
      {a.hasEmail && <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} label="Avisar a cliente por e-mail" />}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Salvando…" : "Reagendar"}</Button>
    </form>
  );
}

function ValuesForm({ a, pending, onSubmit }: {
  a: Appt; pending: boolean;
  onSubmit: (v: { priceCents: number; discountCents: number; paidCents: number; paymentMethod: "" | "pix" | "cartao_credito" | "cartao_debito" | "dinheiro" | "outro"; internalNotes: string }) => void;
}) {
  const [price, setPrice] = useState(toReais(a.priceCents));
  const [discount, setDiscount] = useState(toReais(a.discountCents));
  const [paid, setPaid] = useState(toReais(a.paidCents));
  const [method, setMethod] = useState(a.paymentMethod);
  const [notes, setNotes] = useState(a.internalNotes);
  const balance = toCents(price) - toCents(discount) - toCents(paid);
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ priceCents: toCents(price), discountCents: toCents(discount), paidCents: toCents(paid), paymentMethod: method as "", internalNotes: notes }); }}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Preço (R$)"><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="Desconto"><Input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>
        <Field label="Recebido"><Input inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} /></Field>
      </div>
      <p className="text-sm text-muted">Saldo a receber: <strong className="text-ink tnum">{(balance / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></p>
      <Field label="Forma de pagamento">
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">—</option><option value="pix">Pix</option><option value="cartao_credito">Cartão de crédito</option>
          <option value="cartao_debito">Cartão de débito</option><option value="dinheiro">Dinheiro</option><option value="outro">Outro</option>
        </Select>
      </Field>
      <Field label="Observações internas"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></Field>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
    </form>
  );
}
