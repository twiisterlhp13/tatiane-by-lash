"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { fmtLocalDateLong } from "@/lib/time";
import { SlotPicker, type Slot } from "../../slot-picker";
import { clientCancelAction, clientRescheduleAction } from "../actions";

export function ManageActions(props: {
  slug: string; code: string; token: string; appointmentId: string; serviceId: string; professionalId: string; today: string;
  canCancel: boolean; canReschedule: boolean; requireReason: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "cancel" | "reschedule">(null);
  const [reason, setReason] = useState("");
  const [slot, setSlot] = useState<{ s: Slot; date: string } | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const base = { slug: props.slug, code: props.code, token: props.token };

  if (!props.canCancel && !props.canReschedule) return null;

  return (
    <div className="mt-6 border-t border-line pt-5">
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {mode === null && (
        <div className="grid gap-2 sm:grid-cols-2">
          {props.canReschedule && <Button variant="secondary" onClick={() => setMode("reschedule")}>Reagendar</Button>}
          {props.canCancel && <Button variant="danger" onClick={() => setMode("cancel")}>Cancelar</Button>}
        </div>
      )}

      {mode === "cancel" && (
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await clientCancelAction({ ...base, reason });
            if (r.ok) { setMsg({ tone: "ok", text: "Agendamento cancelado. O horário foi liberado." }); setMode(null); router.refresh(); }
            else setMsg({ tone: "danger", text: r.error });
          });
        }}>
          <Field label={props.requireReason ? "Motivo do cancelamento" : "Quer contar o motivo? (opcional)"}>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} required={props.requireReason} maxLength={500} />
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setMode(null)}>Voltar</Button>
            <Button type="submit" variant="danger" className="flex-1" disabled={pending}>{pending ? "Cancelando…" : "Confirmar cancelamento"}</Button>
          </div>
        </form>
      )}

      {mode === "reschedule" && (
        <div>
          <p className="mb-3 font-medium">Escolha o novo horário</p>
          <SlotPicker slug={props.slug} serviceId={props.serviceId} professionalId={props.professionalId} today={props.today}
            excludeAppointmentId={props.appointmentId} value={slot?.s ?? null} onPick={(s, date) => setSlot({ s, date })} />
          {slot && (
            <div className="mt-2 rounded-xl bg-berry-soft/60 px-4 py-3 text-sm">
              Novo horário: <strong >{fmtLocalDateLong(slot.date)}, {slot.s.time}</strong>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setMode(null); setSlot(null); }}>Voltar</Button>
            <Button className="flex-1" disabled={!slot || pending} onClick={() => start(async () => {
              const r = await clientRescheduleAction({ ...base, startsAt: slot!.s.start });
              if (r.ok) { setMsg({ tone: "ok", text: "Pronto! Seu horário foi alterado." }); setMode(null); setSlot(null); router.refresh(); }
              else setMsg({ tone: "danger", text: r.error });
            })}>{pending ? "Salvando…" : "Confirmar novo horário"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
