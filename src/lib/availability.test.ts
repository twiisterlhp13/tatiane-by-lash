import { describe, expect, it } from "vitest";
import {
  canClientChange,
  checkInterval,
  expandBlocks,
  mergeSlots,
  slotsForDate,
  type ProfessionalSchedule,
  type SlotRules,
} from "./availability";
import { localToUtc, fmtTime } from "./time";

const TZ = "America/Sao_Paulo";
const DATE = "2026-12-02"; // quarta-feira

function schedule(partial: Partial<ProfessionalSchedule> = {}): ProfessionalSchedule {
  return {
    professionalId: "p1",
    weekly: [
      { weekday: 3, startMinute: 9 * 60, endMinute: 12 * 60 },
      { weekday: 3, startMinute: 13 * 60, endMinute: 18 * 60 },
    ],
    special: [],
    busy: [],
    blocks: [],
    ...partial,
  };
}

function rules(partial: Partial<SlotRules> = {}): SlotRules {
  return {
    durationMinutes: 60,
    bufferMinutes: 0,
    stepMinutes: 60,
    earliest: new Date("2000-01-01T00:00:00Z"),
    latest: new Date("2100-01-01T00:00:00Z"),
    ...partial,
  };
}

const times = (slots: Date[]) => slots.map((s) => fmtTime(s, TZ));

describe("slotsForDate", () => {
  it("gera horários dentro das janelas, respeitando a pausa do almoço", () => {
    const slots = slotsForDate(schedule(), DATE, rules(), TZ);
    expect(times(slots)).toEqual(["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"]);
  });

  it("não oferece horário em dia sem expediente", () => {
    expect(slotsForDate(schedule(), "2026-12-06", rules(), TZ)).toEqual([]); // domingo
  });

  it("serviço longo não ultrapassa o fim do expediente", () => {
    const slots = slotsForDate(schedule(), DATE, rules({ durationMinutes: 150, stepMinutes: 30 }), TZ);
    expect(times(slots)).toEqual(["09:00", "09:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"]);
  });

  it("remove horários que conflitam com agendamentos ativos", () => {
    const busy = [{ start: localToUtc(DATE, 10 * 60, TZ), end: localToUtc(DATE, 11 * 60, TZ) }];
    const slots = slotsForDate(schedule({ busy }), DATE, rules({ stepMinutes: 30 }), TZ);
    expect(times(slots)).not.toContain("09:30");
    expect(times(slots)).not.toContain("10:00");
    expect(times(slots)).not.toContain("10:30");
    expect(times(slots)).toContain("09:00");
    expect(times(slots)).toContain("11:00");
  });

  it("considera o intervalo pós-atendimento do novo serviço", () => {
    const busy = [{ start: localToUtc(DATE, 10 * 60, TZ), end: localToUtc(DATE, 11 * 60, TZ) }];
    const slots = slotsForDate(schedule({ busy }), DATE, rules({ bufferMinutes: 15 }), TZ);
    // 09:00–10:00 + 15 min de intervalo invade o agendamento das 10:00
    expect(times(slots)).not.toContain("09:00");
  });

  it("remove horários bloqueados (compromisso pessoal)", () => {
    const blocks = [{
      professionalId: "p1",
      startsAt: localToUtc(DATE, 14 * 60, TZ),
      endsAt: localToUtc(DATE, 16 * 60, TZ),
      recurrence: "none" as const,
      recurrenceUntil: null,
    }];
    const slots = slotsForDate(schedule({ blocks }), DATE, rules(), TZ);
    expect(times(slots)).toEqual(["09:00", "10:00", "11:00", "13:00", "16:00", "17:00"]);
  });

  it("bloqueio semanal recorrente bloqueia semanas seguintes até a data final", () => {
    const blocks = [{
      professionalId: "p1",
      startsAt: localToUtc("2026-11-25", 9 * 60, TZ),
      endsAt: localToUtc("2026-11-25", 10 * 60, TZ),
      recurrence: "weekly" as const,
      recurrenceUntil: "2026-12-09",
    }];
    expect(times(slotsForDate(schedule({ blocks }), DATE, rules(), TZ))).not.toContain("09:00");
    expect(times(slotsForDate(schedule({ blocks }), "2026-12-16", rules(), TZ))).toContain("09:00");
  });

  it("férias de vários dias bloqueiam o dia inteiro", () => {
    const blocks = [{
      professionalId: "p1",
      startsAt: localToUtc("2026-11-30", 0, TZ),
      endsAt: localToUtc("2026-12-05", 0, TZ),
      recurrence: "none" as const,
      recurrenceUntil: null,
    }];
    expect(slotsForDate(schedule({ blocks }), DATE, rules(), TZ)).toEqual([]);
  });

  it("aplica antecedência mínima e janela máxima", () => {
    const slots = slotsForDate(
      schedule(),
      DATE,
      rules({ earliest: localToUtc(DATE, 10 * 60 + 1, TZ), latest: localToUtc(DATE, 15 * 60, TZ) }),
      TZ,
    );
    expect(times(slots)).toEqual(["11:00", "13:00", "14:00", "15:00"]);
  });

  it("exceção por data substitui o horário semanal e pode fechar o dia", () => {
    const open = schedule({ special: [{ date: "2026-12-06", startMinute: 10 * 60, endMinute: 12 * 60 }] });
    expect(times(slotsForDate(open, "2026-12-06", rules(), TZ))).toEqual(["10:00", "11:00"]);
    const closed = schedule({ special: [{ date: DATE, startMinute: 0, endMinute: 0 }] });
    expect(slotsForDate(closed, DATE, rules(), TZ)).toEqual([]);
  });
});

describe("expandBlocks", () => {
  it("bloqueio diário gera uma ocorrência por dia", () => {
    const iv = expandBlocks(
      [{ professionalId: null, startsAt: localToUtc("2026-12-01", 12 * 60, TZ), endsAt: localToUtc("2026-12-01", 13 * 60, TZ), recurrence: "daily", recurrenceUntil: null }],
      localToUtc("2026-12-01", 0, TZ),
      localToUtc("2026-12-04", 0, TZ),
      TZ,
    );
    expect(iv).toHaveLength(3);
  });
});

describe("checkInterval", () => {
  it("detecta fora do expediente, conflito e bloqueio", () => {
    const s = schedule({
      busy: [{ start: localToUtc(DATE, 9 * 60, TZ), end: localToUtc(DATE, 10 * 60, TZ) }],
      blocks: [{ professionalId: "p1", startsAt: localToUtc(DATE, 15 * 60, TZ), endsAt: localToUtc(DATE, 16 * 60, TZ), recurrence: "none", recurrenceUntil: null }],
    });
    const iv = (h: number) => ({ start: localToUtc(DATE, h * 60, TZ), end: localToUtc(DATE, h * 60 + 60, TZ) });
    expect(checkInterval(s, iv(7), TZ)).toEqual({ ok: false, reason: "outside_hours" });
    expect(checkInterval(s, iv(9), TZ)).toEqual({ ok: false, reason: "conflict" });
    expect(checkInterval(s, iv(15), TZ)).toEqual({ ok: false, reason: "blocked" });
    expect(checkInterval(s, iv(14), TZ)).toEqual({ ok: true });
    expect(checkInterval(s, iv(7), TZ, { ignoreWorkingHours: true })).toEqual({ ok: true });
  });
});

describe("mergeSlots", () => {
  it("une horários de vários profissionais", () => {
    const a = new Date("2026-12-02T12:00:00Z");
    const b = new Date("2026-12-02T13:00:00Z");
    expect(mergeSlots([{ professionalId: "p1", slots: [a, b] }, { professionalId: "p2", slots: [b] }])).toEqual([
      { start: a, professionalIds: ["p1"] },
      { start: b, professionalIds: ["p1", "p2"] },
    ]);
  });
});

describe("política de cancelamento", () => {
  const start = new Date("2026-12-02T15:00:00Z");
  it("permite até X horas antes", () => {
    expect(canClientChange(start, new Date("2026-12-01T15:00:00Z"), 24)).toBe(true);
    expect(canClientChange(start, new Date("2026-12-01T15:00:01Z"), 24)).toBe(false);
  });
  it("0 horas desativa a alteração online", () => {
    expect(canClientChange(start, new Date("2026-11-01T00:00:00Z"), 0)).toBe(false);
  });
});

describe("fuso horário", () => {
  it("armazena em UTC e converte para o horário de Brasília", () => {
    expect(localToUtc(DATE, 9 * 60, TZ).toISOString()).toBe("2026-12-02T12:00:00.000Z");
  });
});
