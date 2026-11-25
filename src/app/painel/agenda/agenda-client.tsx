"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock, Plus, RefreshCw } from "lucide-react";
import { Button, Select, cx } from "@/components/ui";
import { Modal } from "@/components/modal";
import { addDays, fmtLocalDateLong, fmtLocalDateShort, minutesToHHMM, utcToLocalParts, weekdayOf } from "@/lib/time";
import type { AgendaItem } from "@/app/api/painel/agenda/route";
import { AppointmentForm, BlockForm, BlockDetails, MoveConfirm } from "./agenda-forms";

export type Pro = { id: string; name: string; color: string };
export type Svc = { id: string; name: string; durationMinutes: number; priceCents: number; professionalIds: string[] };

type View = "day" | "week" | "month";
const PX_PER_MIN = 1.4;
const BLOCK_LABEL: Record<string, string> = {
  personal: "Compromisso", break: "Pausa", vacation: "Férias", holiday: "Feriado", maintenance: "Manutenção", other: "Bloqueado",
};

function weekStart(date: string) {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}
function monthGridStart(date: string) {
  return weekStart(date.slice(0, 8) + "01");
}

export function AgendaClient(props: {
  tz: string;
  today: string;
  initialDate?: string;
  openNew: boolean;
  openBlock: boolean;
  professionals: Pro[];
  services: Svc[];
  canManageAll: boolean;
  ownProfessionalId: string | null;
  startHour: number;
  endHour: number;
}) {
  const router = useRouter();
  const { professionals, today } = props;
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(props.initialDate && /^\d{4}-\d{2}-\d{2}$/.test(props.initialDate) ? props.initialDate : today);
  const [prof, setProf] = useState<string>(professionals.length === 1 ? professionals[0].id : "all");
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<
    | null
    | { type: "new"; date?: string; time?: string; professionalId?: string }
    | { type: "block"; date?: string; time?: string; professionalId?: string }
    | { type: "slot"; date: string; time: string; professionalId?: string }
    | { type: "blockInfo"; item: AgendaItem }
    | { type: "move"; item: AgendaItem; date: string; time: string; professionalId?: string }
  >(props.openNew ? { type: "new" } : props.openBlock ? { type: "block" } : null);

  // Em telas largas, começa na semana
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com o tamanho da tela no primeiro carregamento
    if (window.matchMedia("(min-width: 1024px)").matches) setView("week");
  }, []);

  const range = useMemo(() => {
    if (view === "day") return { from: date, to: date };
    if (view === "week") { const s = weekStart(date); return { from: s, to: addDays(s, 6) }; }
    const s = monthGridStart(date); return { from: s, to: addDays(s, 41) };
  }, [view, date]);

  const reqId = useRef(0);
  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/painel/agenda?from=${range.from}&to=${range.to}&prof=${prof}`, { cache: "no-store" });
      if (res.status === 401) { router.push("/entrar"); return; }
      const json = await res.json();
      if (id !== reqId.current) return;
      if (!res.ok) throw new Error(json.error);
      setItems(json.items);
      setError("");
    } catch {
      if (id === reqId.current) setError("Não foi possível atualizar a agenda. Verifique sua conexão.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [range, prof, router]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- busca dados do servidor ao mudar período/filtro
  useEffect(() => { load(); }, [load]);
  // Sincronização quase em tempo real: agendamentos feitos pelo site aparecem sozinhos
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 20000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const colorOf = (id: string | null) => professionals.find((p) => p.id === id)?.color ?? "#8a7880";
  const nameOf = (id: string | null) => (id ? professionals.find((p) => p.id === id)?.name ?? "" : "Todos");

  function shift(dir: -1 | 1) {
    if (view === "day") setDate(addDays(date, dir));
    else if (view === "week") setDate(addDays(date, 7 * dir));
    else {
      const [y, m] = date.split("-").map(Number);
      const nm = new Date(Date.UTC(y, m - 1 + dir, 1));
      setDate(`${nm.getUTCFullYear()}-${String(nm.getUTCMonth() + 1).padStart(2, "0")}-01`);
    }
  }

  const title =
    view === "day"
      ? fmtLocalDateLong(date)
      : view === "week"
        ? `${fmtLocalDateShort(range.from, { day: "2-digit", month: "short" })} – ${fmtLocalDateShort(range.to, { day: "2-digit", month: "short" })}`
        : fmtLocalDateShort(date, { month: "long", year: "numeric" });

  const afterChange = () => { setModal(null); load(); router.refresh(); };

  const dayColumns: { key: string; date: string; professionalId?: string; label: string; sub?: string }[] =
    view === "day"
      ? prof === "all" && professionals.length > 1
        ? professionals.map((p) => ({ key: p.id, date, professionalId: p.id, label: p.name }))
        : [{ key: date, date, professionalId: prof === "all" ? professionals[0]?.id : prof, label: fmtLocalDateShort(date, { weekday: "long" }) }]
      : Array.from({ length: 7 }, (_, i) => {
          const d = addDays(range.from, i);
          return { key: d, date: d, professionalId: prof === "all" ? undefined : prof, label: fmtLocalDateShort(d, { weekday: "short" }), sub: d.slice(8) };
        });

  return (
    <div>
      {/* Barra de ações */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="px-3" aria-label="Anterior" onClick={() => shift(-1)}><ChevronLeft size={18} /></Button>
          <Button variant="secondary" className="px-4" onClick={() => setDate(today)}>Hoje</Button>
          <Button variant="secondary" className="px-3" aria-label="Próximo" onClick={() => shift(1)}><ChevronRight size={18} /></Button>
          <h1 className="ml-2 font-display text-xl sm:text-2xl">{title}</h1>
          {loading && <RefreshCw size={15} className="animate-spin text-muted" aria-label="Atualizando" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setModal({ type: "block", date: view === "month" ? today : date })}>
            <Lock size={16} /> Bloquear horário
          </Button>
          <Button onClick={() => setModal({ type: "new", date: view === "month" ? today : date })}><Plus size={18} /> Agendar</Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" className="inline-flex rounded-full border border-line-2 bg-white p-1 text-sm">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={cx("rounded-full px-4 py-1.5", view === v ? "bg-berry text-white" : "text-ink-2")}>
              {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
        {professionals.length > 1 && (
          <Select value={prof} onChange={(e) => setProf(e.target.value)} className="w-auto min-h-10 rounded-full text-sm" aria-label="Profissional">
            <option value="all">Todas as profissionais</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Ir para data"
          className="min-h-10 rounded-full border border-line-2 bg-white px-3 text-sm" />
      </div>

      {error && <p className="mb-3 rounded-xl bg-danger-soft px-4 py-2 text-sm text-danger">{error}</p>}

      {view === "month" ? (
        <MonthGrid
          from={range.from} anchor={date} today={today} items={items} colorOf={colorOf}
          onPickDay={(d) => { setDate(d); setView("day"); }}
        />
      ) : (
        <TimeGrid
          columns={dayColumns}
          items={items}
          startHour={props.startHour}
          endHour={props.endHour}
          today={today}
          tz={props.tz}
          colorOf={colorOf}
          onEmpty={(c, minute) => setModal({ type: "slot", date: c.date, time: minutesToHHMM(minute), professionalId: c.professionalId })}
          onOpen={(it) => {
            if (it.kind === "appointment") router.push(`/painel/agendamentos/${it.id}`);
            else setModal({ type: "blockInfo", item: it });
          }}
          onDrop={(it, c, minute) => setModal({ type: "move", item: it, date: c.date, time: minutesToHHMM(minute), professionalId: c.professionalId })}
        />
      )}

      {/* Legenda */}
      {professionals.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
          {professionals.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: p.color }} />{p.name}</span>
          ))}
        </div>
      )}

      <Modal open={modal?.type === "slot"} onClose={() => setModal(null)} title={modal?.type === "slot" ? `${fmtLocalDateShort(modal.date)} às ${modal.time}` : ""}>
        {modal?.type === "slot" && (
          <div className="grid gap-3">
            <Button onClick={() => setModal({ ...modal, type: "new" })}><Plus size={18} /> Novo agendamento</Button>
            <Button variant="secondary" onClick={() => setModal({ ...modal, type: "block" })}><Lock size={16} /> Bloquear a partir deste horário</Button>
          </div>
        )}
      </Modal>

      <Modal open={modal?.type === "new"} onClose={() => setModal(null)} title="Novo agendamento">
        {modal?.type === "new" && (
          <AppointmentForm
            professionals={professionals}
            services={props.services}
            defaults={{ date: modal.date ?? date, time: modal.time, professionalId: modal.professionalId ?? (prof !== "all" ? prof : props.ownProfessionalId ?? professionals[0]?.id) }}
            onDone={afterChange}
          />
        )}
      </Modal>

      <Modal open={modal?.type === "block"} onClose={() => setModal(null)} title="Bloquear horário">
        {modal?.type === "block" && (
          <BlockForm
            professionals={professionals}
            canBlockAll={props.canManageAll}
            defaults={{ date: modal.date ?? date, time: modal.time, professionalId: modal.professionalId ?? (prof !== "all" ? prof : props.ownProfessionalId ?? professionals[0]?.id) }}
            onDone={afterChange}
          />
        )}
      </Modal>

      <Modal open={modal?.type === "blockInfo"} onClose={() => setModal(null)} title="Horário bloqueado">
        {modal?.type === "blockInfo" && (
          <BlockDetails item={modal.item} professionalName={nameOf(modal.item.professionalId)} label={BLOCK_LABEL[modal.item.blockKind ?? "other"]} onDone={afterChange} />
        )}
      </Modal>

      <Modal open={modal?.type === "move"} onClose={() => setModal(null)} title="Mover agendamento">
        {modal?.type === "move" && (
          <MoveConfirm item={modal.item} date={modal.date} time={modal.time} professionalId={modal.professionalId} professionalName={nameOf(modal.professionalId ?? modal.item.professionalId)} onDone={afterChange} onCancel={() => setModal(null)} />
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type Col = { key: string; date: string; professionalId?: string; label: string; sub?: string };

function layoutLanes(list: AgendaItem[]) {
  const sorted = [...list].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const lanes: number[] = [];
  const placed: { it: AgendaItem; lane: number; lanes: number }[] = [];
  let group: { it: AgendaItem; lane: number; lanes: number }[] = [];
  let groupEnd = -1;
  for (const it of sorted) {
    if (it.startMin >= groupEnd && group.length) {
      const n = Math.max(...group.map((g) => g.lane)) + 1;
      group.forEach((g) => (g.lanes = n));
      group = [];
      lanes.length = 0;
    }
    let lane = lanes.findIndex((end) => end <= it.startMin);
    if (lane === -1) { lane = lanes.length; lanes.push(it.endMin); } else lanes[lane] = it.endMin;
    const p = { it, lane, lanes: 1 };
    group.push(p);
    placed.push(p);
    groupEnd = Math.max(groupEnd, it.endMin);
  }
  if (group.length) { const n = Math.max(...group.map((g) => g.lane)) + 1; group.forEach((g) => (g.lanes = n)); }
  return placed;
}

function TimeGrid(props: {
  columns: Col[];
  items: AgendaItem[];
  startHour: number;
  endHour: number;
  today: string;
  tz: string;
  colorOf: (id: string | null) => string;
  onEmpty: (c: Col, minute: number) => void;
  onOpen: (it: AgendaItem) => void;
  onDrop: (it: AgendaItem, c: Col, minute: number) => void;
}) {
  const { columns, startHour, endHour } = props;
  const startMin = startHour * 60;
  const totalMin = (endHour - startHour) * 60;
  const height = totalMin * PX_PER_MIN;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const dragItem = useRef<AgendaItem | null>(null);
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => { const p = utcToLocalParts(new Date(), props.tz); setNowMin(p.hour * 60 + p.minute); };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [props.tz]);

  function minuteFromEvent(e: React.MouseEvent | React.DragEvent, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const m = startMin + Math.floor(y / PX_PER_MIN / 15) * 15;
    return Math.max(startMin, Math.min(m, endHour * 60 - 15));
  }

  const many = columns.length > 3;
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-soft)]">
      <div className="scroll-thin overflow-x-auto">
        <div style={{ minWidth: many ? columns.length * 120 + 56 : undefined }}>
          <div className="sticky top-0 z-10 grid border-b border-line bg-white" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(0,1fr))` }}>
            <div />
            {columns.map((c) => (
              <div key={c.key} className={cx("border-l border-line px-2 py-2 text-center text-sm", c.date === props.today && columns.length === 7 && "bg-berry-soft/60")}>
                <span className="block truncate font-medium">{c.label}</span>
                {c.sub && <span className={cx("font-display text-lg", c.date === props.today && "text-berry")}>{c.sub}</span>}
              </div>
            ))}
          </div>
          <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(0,1fr))`, height }}>
            <div className="relative">
              {hours.map((h) => (
                <span key={h} className={cx("absolute right-2 text-[11px] text-muted tnum", h === startHour ? "translate-y-0.5" : "-translate-y-2")} style={{ top: (h * 60 - startMin) * PX_PER_MIN }}>
                  {String(h).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {columns.map((c) => {
              const colItems = props.items.filter((it) => it.date === c.date && (!c.professionalId || it.professionalId === c.professionalId || (it.kind === "block" && it.professionalId === null)));
              const placed = layoutLanes(colItems);
              return (
                <div
                  key={c.key}
                  className="relative cursor-pointer border-l border-line"
                  onClick={(e) => { if (e.target === e.currentTarget) props.onEmpty(c, minuteFromEvent(e, e.currentTarget)); }}
                  onDragOver={(e) => { if (dragItem.current) e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const it = dragItem.current;
                    dragItem.current = null;
                    if (it) props.onDrop(it, c, minuteFromEvent(e, e.currentTarget));
                  }}
                >
                  {hours.map((h) => (
                    <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line/70" style={{ top: (h * 60 - startMin) * PX_PER_MIN }}>
                      <div className="border-t border-dashed border-line/40" style={{ marginTop: 30 * PX_PER_MIN }} />
                    </div>
                  ))}
                  {c.date === props.today && nowMin !== null && nowMin >= startMin && nowMin <= endHour * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-[5] border-t-2 border-berry" style={{ top: (nowMin - startMin) * PX_PER_MIN }}>
                      <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-berry" />
                    </div>
                  )}
                  {placed.map(({ it, lane, lanes }) => {
                    const top = Math.max(0, (it.startMin - startMin) * PX_PER_MIN);
                    const h = Math.max(18, (Math.min(it.endMin, endHour * 60) - Math.max(it.startMin, startMin)) * PX_PER_MIN - 2);
                    const width = `calc(${100 / lanes}% - 4px)`;
                    const left = `calc(${(100 / lanes) * lane}% + 2px)`;
                    if (it.kind === "block") {
                      return (
                        <button key={`${it.id}-${it.date}-${it.startMin}`} onClick={() => props.onOpen(it)}
                          className="absolute z-[2] overflow-hidden rounded-lg border border-line-2 px-2 py-1 text-left text-[11px] text-ink-2"
                          style={{ top, height: h, width, left, background: "repeating-linear-gradient(135deg,#f4ece7,#f4ece7 6px,#ece1db 6px,#ece1db 12px)" }}>
                          <span className="flex items-center gap-1 font-medium"><Lock size={11} /> {it.title || BLOCK_LABEL[it.blockKind ?? "other"]}</span>
                        </button>
                      );
                    }
                    const color = props.colorOf(it.professionalId);
                    const pending = it.status === "pending";
                    const done = it.status === "completed" || it.status === "no_show";
                    return (
                      <button
                        key={`${it.id}-${it.date}`}
                        draggable={it.status === "pending" || it.status === "confirmed"}
                        onDragStart={(e) => { dragItem.current = it; e.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => { setTimeout(() => (dragItem.current = null), 0); }}
                        onClick={() => props.onOpen(it)}
                        className={cx("absolute z-[3] overflow-hidden rounded-lg px-2 py-1 text-left text-[12px] leading-tight shadow-sm", done && "opacity-60")}
                        style={{ top, height: h, width, left, background: pending ? "#fff" : `${color}1f`, borderLeft: `3px solid ${color}`, border: pending ? `1.5px dashed ${color}` : undefined }}
                        title={`${it.client} · ${it.service}`}
                      >
                        <span className="block font-semibold text-ink truncate">{minutesToHHMM(it.startMin)} {it.client}</span>
                        {h > 34 && <span className="block truncate text-ink-2">{it.service}</span>}
                        {pending && h > 50 && <span className="block text-[10px] font-medium text-warn">aguardando</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="border-t border-line px-4 py-2 text-xs text-muted">Toque em um horário vazio para agendar ou bloquear. No computador, arraste um agendamento para movê-lo.</p>
    </div>
  );
}

function MonthGrid(props: { from: string; anchor: string; today: string; items: AgendaItem[]; colorOf: (id: string | null) => string; onPickDay: (d: string) => void }) {
  const month = props.anchor.slice(0, 7);
  const days = Array.from({ length: 42 }, (_, i) => addDays(props.from, i));
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-soft)]">
      <div className="grid grid-cols-7 border-b border-line text-center text-xs uppercase tracking-wider text-muted">
        {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const appts = props.items.filter((it) => it.date === d && it.kind === "appointment").sort((a, b) => a.startMin - b.startMin);
          const blocked = props.items.some((it) => it.date === d && it.kind === "block");
          const inMonth = d.startsWith(month);
          return (
            <button key={d} onClick={() => props.onPickDay(d)}
              className={cx("min-h-20 border-b border-l border-line p-1.5 text-left align-top sm:min-h-28", !inMonth && "bg-paper/60 text-muted")}>
              <span className={cx("inline-flex size-6 items-center justify-center rounded-full text-xs tnum", d === props.today && "bg-berry text-white")}>{Number(d.slice(8))}</span>
              {blocked && <Lock size={11} className="ml-1 inline text-muted" />}
              <span className="mt-1 hidden space-y-0.5 sm:block">
                {appts.slice(0, 3).map((a) => (
                  <span key={a.id} className="block truncate rounded px-1 text-[11px]" style={{ background: `${props.colorOf(a.professionalId)}1f` }}>
                    {minutesToHHMM(a.startMin)} {a.client}
                  </span>
                ))}
                {appts.length > 3 && <span className="block px-1 text-[11px] text-muted">+{appts.length - 3}</span>}
              </span>
              {appts.length > 0 && <span className="mt-1 block text-[11px] font-medium text-berry sm:hidden">{appts.length} agend.</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
