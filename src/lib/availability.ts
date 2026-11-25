/**
 * Motor de disponibilidade — funções puras, sem acesso a banco, para serem testadas isoladamente.
 *
 * disponibilidade = horário de trabalho (ou exceção da data)
 *                 − agendamentos ativos (incluindo intervalo pós-atendimento)
 *                 − bloqueios (pessoais, férias, feriados, pausas; únicos ou recorrentes)
 *                 − antecedência mínima / janela máxima
 */
import { addDays, diffDays, localToUtc, toLocalDate, localMinuteOfDay, weekdayOf, type LocalDate } from "./time";

export type Interval = { start: Date; end: Date };
export type MinuteWindow = { startMinute: number; endMinute: number };

export type WeeklyHour = { weekday: number; startMinute: number; endMinute: number };
export type SpecialHour = { date: LocalDate; startMinute: number; endMinute: number };

export type BlockInput = {
  professionalId: string | null;
  startsAt: Date;
  endsAt: Date;
  recurrence: "none" | "daily" | "weekly";
  recurrenceUntil: LocalDate | null;
};

export type ProfessionalSchedule = {
  professionalId: string;
  weekly: WeeklyHour[];
  special: SpecialHour[];
  /** Agendamentos ativos: [início, fim ocupado). */
  busy: Interval[];
  blocks: BlockInput[];
};

export type SlotRules = {
  durationMinutes: number;
  bufferMinutes: number;
  stepMinutes: number;
  /** Primeiro instante em que um atendimento pode começar. */
  earliest: Date;
  /** Último instante em que um atendimento pode começar. */
  latest: Date;
};

export function overlaps(a: Interval, b: Interval) {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/** Janelas de trabalho do profissional em uma data local. Exceções da data substituem o horário semanal. */
export function windowsForDate(schedule: Pick<ProfessionalSchedule, "weekly" | "special">, date: LocalDate): MinuteWindow[] {
  const special = schedule.special.filter((s) => s.date === date);
  if (special.length > 0) {
    return special
      .filter((s) => s.endMinute > s.startMinute) // início == fim marca o dia como fechado
      .map((s) => ({ startMinute: s.startMinute, endMinute: s.endMinute }))
      .sort((a, b) => a.startMinute - b.startMinute);
  }
  const wd = weekdayOf(date);
  return schedule.weekly
    .filter((h) => h.weekday === wd)
    .map((h) => ({ startMinute: h.startMinute, endMinute: h.endMinute }))
    .sort((a, b) => a.startMinute - b.startMinute);
}

/**
 * Expande bloqueios (inclusive recorrentes) em intervalos concretos dentro de [from, to).
 * Recorrências avançam por dia local, então respeitam o horário de parede mesmo com mudança de fuso/horário de verão.
 */
export function expandBlocks(blocks: BlockInput[], from: Date, to: Date, tz: string): Interval[] {
  const out: Interval[] = [];
  for (const b of blocks) {
    const durationMs = b.endsAt.getTime() - b.startsAt.getTime();
    if (durationMs <= 0) continue;
    if (b.recurrence === "none") {
      const iv = { start: b.startsAt, end: b.endsAt };
      if (overlaps(iv, { start: from, end: to })) out.push(iv);
      continue;
    }
    const step = b.recurrence === "daily" ? 1 : 7;
    const firstDate = toLocalDate(b.startsAt, tz);
    const startMinute = localMinuteOfDay(b.startsAt, tz);
    // começa na ocorrência mais próxima antes de `from` (cobrindo bloqueios longos que atravessam o início da janela)
    const fromDate = toLocalDate(new Date(from.getTime() - durationMs), tz);
    let k = Math.max(0, Math.floor(diffDays(fromDate, firstDate) / step));
    const untilDate = b.recurrenceUntil;
    for (let guard = 0; guard < 2000; guard++, k++) {
      const date = addDays(firstDate, k * step);
      if (untilDate && date > untilDate) break;
      const start = localToUtc(date, startMinute, tz);
      if (start.getTime() >= to.getTime()) break;
      const iv = { start, end: new Date(start.getTime() + durationMs) };
      if (overlaps(iv, { start: from, end: to })) out.push(iv);
    }
  }
  return out;
}

/** Horários de início disponíveis para um profissional em uma data local. */
export function slotsForDate(schedule: ProfessionalSchedule, date: LocalDate, rules: SlotRules, tz: string): Date[] {
  const windows = windowsForDate(schedule, date);
  if (windows.length === 0) return [];

  const dayStart = localToUtc(date, 0, tz);
  const dayEnd = localToUtc(addDays(date, 1), 0, tz);
  const margin = (rules.durationMinutes + rules.bufferMinutes) * 60000;
  const blocks = expandBlocks(schedule.blocks, new Date(dayStart.getTime() - margin), new Date(dayEnd.getTime() + margin), tz);
  const unavailable = [...schedule.busy, ...blocks];

  const step = Math.max(5, rules.stepMinutes);
  const out: Date[] = [];
  for (const w of windows) {
    for (let m = w.startMinute; m + rules.durationMinutes <= w.endMinute; m += step) {
      const start = localToUtc(date, m, tz);
      if (start < rules.earliest || start > rules.latest) continue;
      const serviceEnd = new Date(start.getTime() + rules.durationMinutes * 60000);
      const occupied: Interval = { start, end: new Date(serviceEnd.getTime() + rules.bufferMinutes * 60000) };
      // o atendimento em si não pode cruzar um bloqueio/agendamento; o intervalo pós-atendimento também não
      if (unavailable.some((u) => overlaps(occupied, u))) continue;
      out.push(start);
    }
  }
  return out;
}

export type SlotOption = { start: Date; professionalIds: string[] };

/** Junta os horários de vários profissionais (opção "qualquer profissional"). */
export function mergeSlots(perProfessional: { professionalId: string; slots: Date[] }[]): SlotOption[] {
  const map = new Map<number, string[]>();
  for (const p of perProfessional) {
    for (const s of p.slots) {
      const k = s.getTime();
      const arr = map.get(k) ?? [];
      arr.push(p.professionalId);
      map.set(k, arr);
    }
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([k, ids]) => ({ start: new Date(k), professionalIds: ids }));
}

/** Verifica se um intervalo específico cabe no horário de trabalho e não conflita (validação do painel). */
export function checkInterval(
  schedule: ProfessionalSchedule,
  interval: Interval,
  tz: string,
  opts: { ignoreWorkingHours?: boolean } = {},
): { ok: true } | { ok: false; reason: "outside_hours" | "blocked" | "conflict" } {
  if (!opts.ignoreWorkingHours) {
    const date = toLocalDate(interval.start, tz);
    const startMin = localMinuteOfDay(interval.start, tz);
    const durMin = Math.round((interval.end.getTime() - interval.start.getTime()) / 60000);
    const windows = windowsForDate(schedule, date);
    const fits = windows.some((w) => startMin >= w.startMinute && startMin + durMin <= w.endMinute);
    if (!fits) return { ok: false, reason: "outside_hours" };
  }
  if (schedule.busy.some((b) => overlaps(b, interval))) return { ok: false, reason: "conflict" };
  const blocks = expandBlocks(schedule.blocks, new Date(interval.start.getTime() - 86400000 * 60), interval.end, tz);
  if (blocks.some((b) => overlaps(b, interval))) return { ok: false, reason: "blocked" };
  return { ok: true };
}

/** Regras de política de cancelamento/reagendamento pela cliente. */
export function canClientChange(startsAt: Date, now: Date, untilHours: number): boolean {
  if (untilHours <= 0) return false;
  return startsAt.getTime() - now.getTime() >= untilHours * 3600000;
}
