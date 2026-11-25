"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Card, Checkbox, Field, Input, Select, cx } from "@/components/ui";
import { fmtLocalDateLong } from "@/lib/time";
import { addSpecialHourAction, deleteSpecialHourAction, saveWeeklyHoursAction } from "./actions";

const WD = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
type Day = { weekday: number; intervals: { start: string; end: string }[] };
type Special = { id: string; date: string; closed: boolean; start: string; end: string; note: string };

export function HoursEditor({ professionals, selectedId, days: initial, special, canManageAll }: {
  professionals: { id: string; name: string }[]; selectedId: string; days: Day[]; special: Special[]; canManageAll: boolean;
}) {
  const router = useRouter();
  const [days, setDays] = useState(initial);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [alsoBusiness, setAlsoBusiness] = useState(canManageAll);
  const [applyAll, setApplyAll] = useState(false);
  const [pending, start] = useTransition();

  const update = (wd: number, fn: (d: Day) => Day) => setDays(days.map((d) => (d.weekday === wd ? fn(d) : d)));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Card className="p-5 sm:p-6">
        {professionals.length > 1 && (
          <Field label="Profissional" className="mb-5 max-w-xs">
            <Select value={selectedId} onChange={(e) => router.push(`/painel/horarios?p=${e.target.value}`)}>
              {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        )}
        {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
        <div className="divide-y divide-line">
          {ORDER.map((wd) => {
            const d = days.find((x) => x.weekday === wd)!;
            const open = d.intervals.length > 0;
            return (
              <div key={wd} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-start">
                <label className="flex w-36 shrink-0 items-center gap-3 pt-2.5">
                  <input type="checkbox" className="size-5 accent-[var(--color-berry)]" checked={open}
                    onChange={(e) => update(wd, (x) => ({ ...x, intervals: e.target.checked ? [{ start: "09:00", end: "18:00" }] : [] }))} />
                  <span className={cx("font-medium", !open && "text-muted")}>{WD[wd]}</span>
                </label>
                {open ? (
                  <div className="flex-1 space-y-2">
                    {d.intervals.map((iv, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input type="time" step={300} value={iv.start} aria-label="Início" className="max-w-[120px]"
                          onChange={(e) => update(wd, (x) => ({ ...x, intervals: x.intervals.map((y, k) => (k === i ? { ...y, start: e.target.value } : y)) }))} />
                        <span className="text-muted">às</span>
                        <Input type="time" step={300} value={iv.end} aria-label="Fim" className="max-w-[120px]"
                          onChange={(e) => update(wd, (x) => ({ ...x, intervals: x.intervals.map((y, k) => (k === i ? { ...y, end: e.target.value } : y)) }))} />
                        {d.intervals.length > 1 && (
                          <button aria-label="Remover intervalo" className="p-2 text-muted hover:text-danger" onClick={() => update(wd, (x) => ({ ...x, intervals: x.intervals.filter((_, k) => k !== i) }))}><Trash2 size={16} /></button>
                        )}
                      </div>
                    ))}
                    {d.intervals.length < 3 && (
                      <button className="inline-flex items-center gap-1 text-sm text-berry"
                        onClick={() => update(wd, (x) => ({ ...x, intervals: [...x.intervals, { start: x.intervals[x.intervals.length - 1].end, end: "19:00" }] }))}>
                        <Plus size={15} /> Adicionar intervalo (ex.: depois do almoço)
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="pt-2.5 text-sm text-muted">Fechado</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-5 space-y-2 border-t border-line pt-5">
          {canManageAll && <Checkbox checked={alsoBusiness} onChange={(e) => setAlsoBusiness(e.target.checked)} label="Mostrar este horário como horário de funcionamento na página pública" />}
          {canManageAll && professionals.length > 1 && <Checkbox checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} label="Aplicar este horário a todas as profissionais" />}
        </div>
        <Button className="mt-5" disabled={pending} onClick={() => start(async () => {
          const r = await saveWeeklyHoursAction({ professionalId: selectedId, days, alsoBusinessHours: alsoBusiness, applyToAll: applyAll });
          setMsg(r.ok ? { tone: "ok", text: "Horários salvos. A página de agendamento já foi atualizada." } : { tone: "danger", text: r.error });
          if (r.ok) router.refresh();
        })}>{pending ? "Salvando…" : "Salvar horários"}</Button>
      </Card>

      <SpecialHours professionalId={selectedId} special={special} />
    </div>
  );
}

function SpecialHours({ professionalId, special }: { professionalId: string; special: Special[] }) {
  const router = useRouter();
  const [v, setV] = useState({ date: "", closed: false, start: "09:00", end: "13:00", note: "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-xl">Horários especiais</h2>
      <p className="mt-1 text-sm text-muted">Para uma data específica: abrir em um dia que normalmente é fechado ou atender em horário diferente. Para folgas, férias e compromissos, use <strong>Bloquear horário</strong> na agenda.</p>
      <form className="mt-4 space-y-3" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addSpecialHourAction({ professionalId, ...v });
          if (r.ok) { setV({ ...v, date: "", note: "" }); setError(""); router.refresh(); } else setError(r.error);
        });
      }}>
        <Alert>{error}</Alert>
        <Field label="Data"><Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} required /></Field>
        <Checkbox checked={v.closed} onChange={(e) => setV({ ...v, closed: e.target.checked })} label="Fechado nesta data" />
        {!v.closed && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Das"><Input type="time" step={300} value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} /></Field>
            <Field label="Até"><Input type="time" step={300} value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} /></Field>
          </div>
        )}
        <Field label="Observação (interna)"><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="Ex.: sábado de Natal" /></Field>
        <Button type="submit" variant="secondary" disabled={pending}>Adicionar</Button>
      </form>
      {special.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {special.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span>
                <span className="block font-medium">{fmtLocalDateLong(s.date)}</span>
                <span className="text-muted">{s.closed ? "Fechado" : `${s.start} às ${s.end}`}{s.note && ` · ${s.note}`}</span>
              </span>
              <button aria-label="Remover" className="p-2 text-muted hover:text-danger" onClick={() => start(async () => { await deleteSpecialHourAction(s.id); router.refresh(); })}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
