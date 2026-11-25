"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, fmtLocalDateShort } from "@/lib/time";
import { cx } from "@/components/ui";

export type Slot = { start: string; time: string; professionalIds: string[] };
type Day = { date: string; slots: Slot[] };

const PAGE = 14;

export function SlotPicker({ slug, serviceId, professionalId, today, excludeAppointmentId, value, onPick }: {
  slug: string;
  serviceId: string;
  professionalId: string;
  today: string;
  excludeAppointmentId?: string;
  value: Slot | null;
  onPick: (slot: Slot, date: string) => void;
}) {
  const [from, setFrom] = useState(today);
  const [selected, setSelectedDate] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  // resultado guardado junto com a consulta que o gerou: enquanto não chega, é "carregando"
  const query = useMemo(() => {
    const q = new URLSearchParams({ service: serviceId, prof: professionalId, from, days: String(PAGE) });
    if (excludeAppointmentId) q.set("exclude", excludeAppointmentId);
    return q.toString();
  }, [serviceId, professionalId, from, excludeAppointmentId]);
  const [result, setResult] = useState<{ query: string; days: Day[] | null; error: string } | null>(null);
  const days = result?.query === query ? result.days : null;
  const error = result?.query === query ? result.error : "";

  useEffect(() => {
    let cancel = false;
    fetch(`/api/public/${slug}/disponibilidade?${query}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        return j.days as Day[];
      })
      .then((d) => { if (!cancel) setResult({ query, days: d, error: "" }); })
      .catch((e) => { if (!cancel) setResult({ query, days: null, error: e.message || "Não foi possível carregar os horários." }); });
    return () => { cancel = true; };
  }, [slug, query]);

  const firstWithSlots = days?.find((x) => x.slots.length > 0)?.date ?? null;
  const selectedDate = selected && days?.some((x) => x.date === selected && x.slots.length) ? selected : firstWithSlots;

  const current = days?.find((d) => d.date === selectedDate);
  const groups = useMemo(() => {
    const g: { label: string; slots: Slot[] }[] = [
      { label: "Manhã", slots: [] }, { label: "Tarde", slots: [] }, { label: "Noite", slots: [] },
    ];
    for (const s of current?.slots ?? []) {
      const h = Number(s.time.slice(0, 2));
      g[h < 12 ? 0 : h < 18 ? 1 : 2].slots.push(s);
    }
    return g.filter((x) => x.slots.length);
  }, [current]);
  const noneInPage = days && days.every((d) => d.slots.length === 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-2">{fmtLocalDateShort(from, { month: "long", year: "numeric" })}</p>
        <div className="flex gap-1">
          <button type="button" aria-label="Datas anteriores" disabled={from <= today} onClick={() => setFrom(addDays(from, -PAGE) < today ? today : addDays(from, -PAGE))}
            className="rounded-full p-2 text-ink-2 hover:bg-paper-2 disabled:opacity-30"><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Próximas datas" onClick={() => setFrom(addDays(from, PAGE))}
            className="rounded-full p-2 text-ink-2 hover:bg-paper-2"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div ref={strip} className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="listbox" aria-label="Datas">
        {(days ?? Array.from({ length: 7 }, (_, i) => ({ date: addDays(from, i), slots: [] as Slot[] }))).map((d) => {
          const has = d.slots.length > 0;
          const active = d.date === selectedDate;
          return (
            <button key={d.date} type="button" role="option" aria-selected={active} disabled={!days || !has} onClick={() => setSelectedDate(d.date)}
              className={cx(
                "flex w-[60px] shrink-0 flex-col items-center rounded-2xl border py-2.5 transition-colors",
                active ? "border-berry bg-berry text-white" : has ? "border-line-2 bg-white hover:border-berry" : "border-transparent bg-paper-2/60 text-muted/60",
                !days && "animate-pulse",
              )}>
              <span className="text-[11px] uppercase tracking-wide">{fmtLocalDateShort(d.date, { weekday: "short" }).replace(".", "")}</span>
              <span className="font-display text-xl leading-tight">{Number(d.date.slice(8))}</span>
              <span className={cx("mt-0.5 size-1.5 rounded-full", has ? (active ? "bg-white" : "bg-berry") : "bg-transparent")} />
            </button>
          );
        })}
      </div>

      <div className="mt-4 min-h-28">
        {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
        {!days && !error && <p className="text-sm text-muted">Carregando horários…</p>}
        {noneInPage && (
          <div className="rounded-xl bg-paper-2 px-4 py-4 text-sm text-ink-2">
            Sem horários livres nestes dias.{" "}
            <button type="button" className="font-medium text-berry underline" onClick={() => setFrom(addDays(from, PAGE))}>Ver próximas datas</button>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.label} className="mb-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">{g.label}</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {g.slots.map((s) => {
                const active = value?.start === s.start;
                return (
                  <button key={s.start} type="button" onClick={() => onPick(s, current!.date)}
                    className={cx("min-h-11 rounded-xl border text-[15px] font-medium tnum transition-colors",
                      active ? "border-berry bg-berry text-white" : "border-line-2 bg-white hover:border-berry hover:text-berry")}>
                    {s.time}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
