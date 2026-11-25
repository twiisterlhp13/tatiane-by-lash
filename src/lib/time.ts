import { TZDate } from "@date-fns/tz";

/** Data local no formato YYYY-MM-DD. */
export type LocalDate = string;

export const DEFAULT_TZ = "America/Sao_Paulo";

/** Converte data local + minuto do dia (no fuso informado) para um instante UTC. */
export function localToUtc(date: LocalDate, minuteOfDay: number, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const h = Math.floor(minuteOfDay / 60);
  const min = minuteOfDay % 60;
  // TZDate normaliza minutos/horas excedentes (ex.: 24:00 vira 00:00 do dia seguinte)
  const t = new TZDate(y, m - 1, d, h, min, 0, 0, tz);
  return new Date(t.getTime());
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    partsCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function utcToLocalParts(instant: Date, tz: string): Parts {
  const parts = partsFormatter(tz).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: WEEKDAYS[get("weekday")] ?? 0,
  };
}

export function toLocalDate(instant: Date, tz: string): LocalDate {
  const p = utcToLocalParts(instant, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function localMinuteOfDay(instant: Date, tz: string): number {
  const p = utcToLocalParts(instant, tz);
  return p.hour * 60 + p.minute;
}

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Dia da semana (0 = domingo) de uma data local. Independe de fuso. */
export function weekdayOf(date: LocalDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function diffDays(a: LocalDate, b: LocalDate): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000);
}

export function isValidLocalDate(s: string): s is LocalDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function minutesToHHMM(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function hhmmToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return null;
  return h * 60 + mi;
}

/* ------------------------- Formatação pt-BR ------------------------- */

/** Primeira letra maiúscula (o CSS "capitalize" deixaria "Quinta-Feira, 26 De Novembro"). */
export function ucfirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtTime(instant: Date, tz: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(instant);
}

export function fmtDate(instant: Date, tz: string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, ...opts }).format(instant);
}

export function fmtLongDate(instant: Date, tz: string) {
  return ucfirst(new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(instant));
}

export function fmtLocalDateLong(date: LocalDate) {
  const [y, m, d] = date.split("-").map(Number);
  return ucfirst(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(Date.UTC(y, m - 1, d, 12))),
  );
}

export function fmtLocalDateShort(date: LocalDate, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "2-digit" }) {
  const [y, m, d] = date.split("-").map(Number);
  return ucfirst(new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(y, m - 1, d, 12))));
}

export function fmtMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${pad(m)}` : `${h}h`;
}
