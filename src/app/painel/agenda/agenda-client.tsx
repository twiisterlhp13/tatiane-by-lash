"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Lock, Plus, RefreshCw } from "lucide-react";
import { Fab } from "../fab";
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
  const [view, setView] = useState<View>("week");
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
      {/* Barra compacta: mês, visualização e filtro */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[15px] font-medium shadow-[var(--shadow-soft)] ring-1 ring-line">
          {fmtLocalDateShort(date, { month: "long", year: "numeric" })}
          <ChevronDown size={16} className="text-muted" />
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Ir para data"
            className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        {loading && <RefreshCw size={15} className="animate-spin text-muted" aria-label="Atualizando" />}
        <div className="ml-auto flex items-center gap-2">
          {professionals.length > 1 && (
            <Select value={prof} onChange={(e) => setProf(e.target.value)} className="w-auto min-h-9 max-w-40 rounded-full py-1 text-sm" aria-label="Profissional">
              <option value="all">Todas</option>
              {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
          <div role="tablist" className="inline-flex rounded-full bg-white p-1 text-[13px] shadow-[var(--shadow-soft)] ring-1 ring-line">
            {(["day", "week", "month"] as View[]).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={cx("rounded-full px-3 py-1", view === v ? "bg-berry text-white" : "text-ink-2")}>
                {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
        </div>
      </div>
      {view === "day" && <p className="mb-2 px-1 text-sm font-medium text-ink-2">{title}</p>}

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

      {/* Navegação flutuante ‹ HOJE › e botão + */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom,0px))] z-20 flex items-center justify-start gap-3 pl-4 sm:justify-center sm:pl-0">
        <button aria-label="Anterior" onClick={() => shift(-1)} className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-rimel text-white shadow-lg active:scale-95"><ChevronLeft size={22} /></button>
        <button onClick={() => setDate(today)} className="pointer-events-auto rounded-full bg-white px-7 py-3 text-sm font-semibold text-ink shadow-lg ring-1 ring-line active:scale-95">Hoje</button>
        <button aria-label="Próximo" onClick={() => shift(1)} className="pointer-events-auto flex size-12 items-center justify-center rounded-full bg-rimel text-white shadow-lg active:scale-95"><ChevronRight size={22} /></button>
      </div>
      <Fab label="Agendar ou bloquear" onClick={() => setModal({ type: "slot", date: view === "month" ? today : date, time: "" })} />

      <Modal open={modal?.type === "slot"} onClose={() => setModal(null)} title={modal?.type === "slot" ? (modal.time ? `${fmtLocalDateShort(modal.date)} às ${modal.time}` : "O que você quer fazer?") : ""}>
        {modal?.type === "slot" && (
          <div className="grid gap-3">
            <Button onClick={() => setModal({ ...modal, type: "new" })}><Plus size={18} /> Novo agendamento</Button>
            <Button variant="secondary" onClick={() => setModal({ ...modal, type: "block" })}><Lock size={16} /> {modal.time ? "Bloquear a partir deste horário" : "Bloquear horário"}</Button>
          </div>
        )}
      </Modal>

      <Modal open={modal?.type === "new"} onClose={() => setModal(null)} title="Novo agendamento">
        {modal?.type === "new" && (
          <AppointmentForm
            professionals={professionals}
            services={props.services}
            defaults={{ date: modal.date ?? date, time: modal.time || undefined, professionalId: modal.professionalId ?? (prof !== "all" ? prof : props.ownProfessionalId ?? professionals[0]?.id) }}
            onDone={afterChange}
          />
        )}
      </Modal>

      <Modal open={modal?.type === "block"} onClose={() => setModal(null)} title="Bloquear horário">
        {modal?.type === "block" && (
          <BlockForm
            professionals={professionals}
            canBlockAll={props.canManageAll}
            defaults={{ date: modal.date ?? date, time: modal.time || undefined, professionalId: modal.professionalId ?? (prof !== "all" ? prof : props.ownProfessionalId ?? professionals[0]?.id) }}
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

  // várias profissionais no mesmo dia: rola de lado; a semana cabe inteira na tela
  const many = columns.length > 3 && columns.length !== 7;
  const compact = columns.length === 7;
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-soft)]">
      <div className="scroll-thin overflow-x-auto">
        <div style={{ minWidth: many ? columns.length * 120 + 44 : undefined }}>
          <div className="sticky top-0 z-10 grid border-b border-line bg-white" style={{ gridTemplateColumns: `${compact ? 40 : 52}px repeat(${columns.length}, minmax(0,1fr))` }}>
            <div />
            {columns.map((c) => (
              <div key={c.key} className={cx("border-l border-line py-1.5 text-center", compact ? "px-0" : "px-2")}>
                <span className={cx("block truncate text-muted", compact ? "text-[11px]" : "text-sm font-medium text-ink")}>{c.label.replace(".", "")}</span>
                {c.sub && (
                  <span className={cx("mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm tnum", c.date === props.today ? "bg-berry font-semibold text-white" : "text-ink")}>{Number(c.sub)}</span>
                )}
              </div>
            ))}
          </div>
          <div className="relative grid" style={{ gridTemplateColumns: `${compact ? 40 : 52}px repeat(${columns.length}, minmax(0,1fr))`, height }}>
            <div className="relative">
              {hours.map((h) => (
                <span key={h} className={cx("absolute right-1.5 text-muted tnum", compact ? "text-[10px]" : "text-[11px]", h === startHour ? "translate-y-0.5" : "-translate-y-2")} style={{ top: (h * 60 - startMin) * PX_PER_MIN }}>
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
                          className={cx("absolute z-[2] overflow-hidden border border-line-2 text-left text-[11px] text-ink-2", compact ? "rounded-[5px] px-[3px] py-0.5" : "rounded-lg px-2 py-1")}
                          style={{ top, height: h, width, left, background: "repeating-linear-gradient(135deg,#f4ece7,#f4ece7 6px,#ece1db 6px,#ece1db 12px)" }}>
                          <span className={cx("flex items-center gap-1 font-medium", compact && "text-[9px]")}>{!compact && <Lock size={11} />} {it.title || BLOCK_LABEL[it.blockKind ?? "other"]}</span>
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
                        className={cx(
                          "absolute z-[3] overflow-hidden text-left leading-tight shadow-sm",
                          compact ? "rounded-[5px] px-[3px] py-0.5 text-[10px]" : "rounded-lg px-2 py-1 text-[12px]",
                          done && "opacity-55",
                        )}
                        style={{
                          top, height: h, width, left,
                          background: pending ? "#fff" : color,
                          color: pending ? color : "#fff",
                          border: pending ? `1.5px dashed ${color}` : undefined,
                        }}
                        title={`${minutesToHHMM(it.startMin)} ${it.client} · ${it.service}`}
                      >
                        {compact ? (
                          <span className="block break-words font-medium [overflow-wrap:anywhere]">{it.client}</span>
                        ) : (
                          <>
                            <span className="block truncate font-semibold">{minutesToHHMM(it.startMin)} {it.client}</span>
                            {h > 34 && <span className="block truncate opacity-90">{it.service}</span>}
                            {pending && h > 50 && <span className="block text-[10px] font-medium">aguardando confirmação</span>}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="border-t border-line px-4 py-2 pb-20 text-xs text-muted lg:pb-2">Toque em um horário vazio para agendar ou bloquear. No computador, arraste um agendamento para movê-lo.</p>
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
