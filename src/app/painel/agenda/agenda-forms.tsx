"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Search, UserPlus } from "lucide-react";
import { Alert, Button, Checkbox, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { fmtDuration, fmtLocalDateLong, fmtMoney, minutesToHHMM } from "@/lib/time";
import type { AgendaItem } from "@/app/api/painel/agenda/route";
import type { Pro, Svc } from "./agenda-client";
import {
  createAppointmentAction,
  createBlockAction,
  createClientInlineAction,
  deleteBlockAction,
  rescheduleAction,
  searchClientsAction,
  type ConflictInfo,
} from "./actions";

type ClientOpt = { id: string; name: string; phone: string };

/* --------------------------- Busca de cliente --------------------------- */

export function ClientPicker({ value, onChange }: { value: ClientOpt | null; onChange: (c: ClientOpt | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ClientOpt[]>([]);
  const [creating, setCreating] = useState(false);
  const [nc, setNc] = useState({ name: "", phone: "", email: "" });
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => { searchClientsAction(q).then(setResults).catch(() => setResults([])); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const shown = q.trim().length >= 2 ? results : [];

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-berry/30 bg-berry-soft/50 px-3.5 py-2.5">
        <div>
          <p className="font-medium">{value.name}</p>
          <p className="text-sm text-muted">{value.phone}</p>
        </div>
        <button type="button" className="text-sm text-berry underline" onClick={() => onChange(null)}>Trocar</button>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="space-y-3 rounded-xl border border-line p-3.5">
        <Alert>{err}</Alert>
        <Input placeholder="Nome completo" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} autoFocus />
        <Input placeholder="WhatsApp com DDD" type="tel" inputMode="tel" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} />
        <Input placeholder="E-mail (opcional, para confirmações)" type="email" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Voltar</Button>
          <Button type="button" disabled={pending} onClick={() => start(async () => {
            const r = await createClientInlineAction(nc);
            if (r.ok && r.data) onChange(r.data); else if (!r.ok) setErr(r.error);
          })}>{pending ? "Salvando…" : "Salvar cliente"}</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <Input className="pl-10" placeholder="Buscar por nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {shown.length > 0 && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {shown.map((c) => (
            <li key={c.id}>
              <button type="button" className="w-full px-3.5 py-2.5 text-left hover:bg-paper-2" onClick={() => onChange(c)}>
                <span className="block font-medium">{c.name}</span>
                <span className="text-sm text-muted">{c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-berry" onClick={() => { setCreating(true); setNc({ ...nc, name: /\d/.test(q) ? "" : q, phone: /\d/.test(q) ? q : "" }); }}>
        <UserPlus size={16} /> Cadastrar nova cliente
      </button>
    </div>
  );
}

/* --------------------------- Novo agendamento --------------------------- */

export function AppointmentForm({ professionals, services, defaults, onDone }: {
  professionals: Pro[];
  services: Svc[];
  defaults: { date: string; time?: string; professionalId?: string };
  onDone: () => void;
}) {
  const [client, setClient] = useState<ClientOpt | null>(null);
  const [professionalId, setProfessionalId] = useState(defaults.professionalId ?? professionals[0]?.id ?? "");
  const available = useMemo(() => services.filter((s) => s.professionalIds.includes(professionalId)), [services, professionalId]);
  const [chosenServiceId, setServiceId] = useState("");
  const serviceId = available.some((s) => s.id === chosenServiceId) ? chosenServiceId : available[0]?.id ?? "";
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time ?? "09:00");
  const [status, setStatus] = useState<"confirmed" | "pending">("confirmed");
  const [notes, setNotes] = useState("");
  const [notify, setNotify] = useState(true);
  const [allowOutside, setAllowOutside] = useState(false);
  const [error, setError] = useState<{ msg: string; code?: string } | null>(null);
  const [pending, start] = useTransition();
  const svc = available.find((s) => s.id === serviceId);


  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!client) { setError({ msg: "Escolha ou cadastre a cliente." }); return; }
        start(async () => {
          const r = await createAppointmentAction({ clientId: client.id, serviceId, professionalId, date, time, status, notes, notifyClient: notify, allowOutsideHours: allowOutside });
          if (r.ok) onDone(); else setError({ msg: r.error, code: r.code });
        });
      }}
    >
      {error && (
        <Alert>
          {error.msg}
          {error.code === "outside_hours" && (
            <Checkbox className="mt-2" checked={allowOutside} onChange={(e) => setAllowOutside(e.target.checked)} label="Encaixar mesmo assim, fora do horário de trabalho" />
          )}
        </Alert>
      )}
      <Field label="Cliente"><ClientPicker value={client} onChange={setClient} /></Field>
      {professionals.length > 1 && (
        <Field label="Profissional">
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Serviço" error={available.length === 0 ? "Nenhum serviço habilitado para esta profissional. Ajuste em Serviços." : undefined}>
        <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
          {available.map((s) => <option key={s.id} value={s.id}>{s.name} · {fmtDuration(s.durationMinutes)} · {fmtMoney(s.priceCents)}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Início" hint={svc ? `Termina às ${minutesToHHMM(Math.min(1439, (Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))) + svc.durationMinutes))}` : undefined}>
          <Input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
      </div>
      <Field label="Situação">
        <Select value={status} onChange={(e) => setStatus(e.target.value as "confirmed" | "pending")}>
          <option value="confirmed">Confirmado</option>
          <option value="pending">Aguardando confirmação</option>
        </Select>
      </Field>
      <Field label="Observações internas" hint="Só a equipe vê.">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} label="Enviar confirmação para a cliente por e-mail (se ela tiver e-mail cadastrado)" />
      <Button type="submit" className="w-full" disabled={pending || !serviceId}>{pending ? "Agendando…" : "Confirmar agendamento"}</Button>
    </form>
  );
}

/* ---------------------------- Bloquear horário --------------------------- */

const KINDS = [
  { value: "personal", label: "Compromisso pessoal" },
  { value: "break", label: "Pausa / intervalo" },
  { value: "vacation", label: "Férias / folga" },
  { value: "holiday", label: "Feriado" },
  { value: "other", label: "Outro" },
] as const;

function plusHour(t: string) {
  const [h, m] = t.split(":").map(Number);
  return minutesToHHMM(Math.min(23 * 60 + 59, h * 60 + m + 60));
}

export function BlockForm({ professionals, canBlockAll, defaults, onDone }: {
  professionals: Pro[];
  canBlockAll: boolean;
  defaults: { date: string; time?: string; professionalId?: string };
  onDone: () => void;
}) {
  const [professionalId, setProfessionalId] = useState(defaults.professionalId ?? professionals[0]?.id ?? "all");
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("personal");
  const [allDay, setAllDay] = useState(false);
  const [date, setDate] = useState(defaults.date);
  const [endDate, setEndDate] = useState(defaults.date);
  const [startTime, setStartTime] = useState(defaults.time ?? "12:00");
  const [endTime, setEndTime] = useState(plusHour(defaults.time ?? "12:00"));
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly">("none");
  const [until, setUntil] = useState("");
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<ConflictInfo[] | null>(null);
  const [pending, start] = useTransition();
  const multiDay = allDay && (kind === "vacation" || endDate !== date);

  function submit(conflictMode: "prevent" | "keep" | "cancel") {
    setError("");
    start(async () => {
      const r = await createBlockAction({
        professionalId, date, endDate: allDay ? endDate : date, allDay, startTime, endTime, kind, title, recurrence, recurrenceUntil: until, conflictMode,
      });
      if (r.ok) onDone();
      else if (r.code === "conflict" && r.conflicts) { setConflicts(r.conflicts); setError(r.error); }
      else setError(r.error);
    });
  }

  if (conflicts) {
    return (
      <div className="space-y-4">
        <Alert tone="warn">{error} O que você quer fazer?</Alert>
        <ul className="divide-y divide-line rounded-xl border border-line text-sm">
          {conflicts.map((c) => (
            <li key={c.id} className="px-3.5 py-2.5">
              <span className="font-medium">{c.client}</span> · {c.service}
              <span className="block text-muted">{new Date(c.startsAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {c.professional}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-2">
          <Button variant="danger" disabled={pending} onClick={() => submit("cancel")}>Cancelar esses agendamentos e bloquear</Button>
          <Button variant="secondary" disabled={pending} onClick={() => submit("keep")}>Bloquear e manter os agendamentos</Button>
          <Button variant="ghost" disabled={pending} onClick={() => { setConflicts(null); setError(""); }}>Voltar e escolher outro período</Button>
        </div>
        <p className="text-xs text-muted">Ao cancelar, as clientes com e-mail recebem um aviso. O motivo interno do bloqueio nunca é mostrado a elas.</p>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit("prevent"); }}>
      <Alert>{error}</Alert>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button key={k.value} type="button" onClick={() => { setKind(k.value); if (k.value === "vacation" || k.value === "holiday") setAllDay(true); }}
            className={cx("rounded-full border px-3.5 py-1.5 text-sm", kind === k.value ? "border-berry bg-berry-soft text-berry" : "border-line-2 text-ink-2")}>
            {k.label}
          </button>
        ))}
      </div>
      {(professionals.length > 1 || canBlockAll) && (
        <Field label="Agenda">
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            {canBlockAll && <option value="all">Todas as profissionais (negócio fechado)</option>}
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      )}
      <Checkbox checked={allDay} onChange={(e) => setAllDay(e.target.checked)} label="Dia inteiro" />
      <div className="grid grid-cols-2 gap-3">
        <Field label={allDay ? "De" : "Data"}><Input type="date" value={date} onChange={(e) => { setDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} required /></Field>
        {allDay ? (
          <Field label="Até"><Input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} required /></Field>
        ) : <div />}
      </div>
      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Das"><Input type="time" step={300} value={startTime} onChange={(e) => { setStartTime(e.target.value); if (e.target.value >= endTime) setEndTime(plusHour(e.target.value)); }} required /></Field>
          <Field label="Até"><Input type="time" step={300} value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></Field>
        </div>
      )}
      {!multiDay && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Repetir">
            <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value as "none")}>
              <option value="none">Não repetir</option>
              <option value="daily">Todos os dias</option>
              <option value="weekly">Toda semana</option>
            </Select>
          </Field>
          {recurrence !== "none" && <Field label="Até (opcional)"><Input type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} /></Field>}
        </div>
      )}
      <Field label="Motivo" hint="Só você vê. Para as clientes o horário aparece apenas como indisponível.">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: dentista, almoço, viagem" />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Bloqueando…" : "Bloquear horário"}</Button>
    </form>
  );
}

export function BlockDetails({ item, professionalName, label, onDone }: { item: AgendaItem; professionalName: string; label: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="space-y-4">
      <Alert>{error}</Alert>
      <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
        <dt className="text-muted">Tipo</dt><dd>{label}</dd>
        <dt className="text-muted">Motivo</dt><dd>{item.title || "—"}</dd>
        <dt className="text-muted">Agenda</dt><dd>{professionalName}</dd>
        <dt className="text-muted">Quando</dt>
        <dd >{fmtLocalDateLong(item.date)}, {item.endMin - item.startMin >= 1440 ? "dia inteiro" : `${minutesToHHMM(item.startMin)}–${minutesToHHMM(item.endMin === 1440 ? 1439 : item.endMin)}`}</dd>
      </dl>
      {item.recurring && <p className="rounded-xl bg-paper-2 px-3.5 py-2.5 text-sm text-ink-2">Este bloqueio se repete. Ao reabrir, todas as repetições são removidas.</p>}
      <Button variant="danger" className="w-full" disabled={pending} onClick={() => start(async () => {
        const r = await deleteBlockAction(item.id);
        if (r.ok) onDone(); else setError(r.error);
      })}>{pending ? "Reabrindo…" : "Reabrir horário (remover bloqueio)"}</Button>
    </div>
  );
}

export function MoveConfirm({ item, date, time, professionalId, professionalName, onDone, onCancel }: {
  item: AgendaItem; date: string; time: string; professionalId?: string; professionalName: string; onDone: () => void; onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ msg: string; code?: string } | null>(null);
  const [allowOutside, setAllowOutside] = useState(false);
  const [notify, setNotify] = useState(true);
  return (
    <div className="space-y-4">
      {error && (
        <Alert>
          {error.msg}
          {error.code === "outside_hours" && <Checkbox className="mt-2" checked={allowOutside} onChange={(e) => setAllowOutside(e.target.checked)} label="Mover mesmo fora do horário de trabalho" />}
        </Alert>
      )}
      <p>
        Mover <strong>{item.client}</strong> ({item.service}) para <strong >{fmtLocalDateLong(date)} às {time}</strong>
        {professionalId && professionalId !== item.professionalId ? <> com <strong>{professionalName}</strong></> : null}?
      </p>
      <Checkbox checked={notify} onChange={(e) => setNotify(e.target.checked)} label="Avisar a cliente por e-mail" />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button className="flex-1" disabled={pending} onClick={() => start(async () => {
          const r = await rescheduleAction({ id: item.id, date, time, professionalId, allowOutsideHours: allowOutside, notifyClient: notify });
          if (r.ok) onDone(); else setError({ msg: r.error, code: r.code });
        })}>{pending ? "Movendo…" : "Mover"}</Button>
      </div>
    </div>
  );
}
