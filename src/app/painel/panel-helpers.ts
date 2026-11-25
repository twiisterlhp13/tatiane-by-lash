export { addDays, fmtLongDate, fmtMoney, fmtTime, localToUtc, toLocalDate, weekdayOf } from "@/lib/time";
import { weekdayOf } from "@/lib/time";

/** Minutos de trabalho em uma data, a partir do horário semanal. */
export function windowsForDateSafe(hours: { weekday: number; startMinute: number; endMinute: number }[], date: string) {
  const wd = weekdayOf(date);
  return hours.filter((h) => h.weekday === wd).reduce((s, h) => s + (h.endMinute - h.startMinute), 0);
}
