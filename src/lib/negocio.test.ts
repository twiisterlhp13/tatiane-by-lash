import { describe, expect, it } from "vitest";
import { ehExtensao, separar, unidade } from "./lash";
import { addMonths, brl, custoMedio, daysInMonth, faturamento, periodos, respostaLocal, resumoNegocio, sumidas, type Ag } from "./negocio";

const TZ = "America/Sao_Paulo";
const DAY = 86400000;
let n = 0;
function ag(p: Partial<Ag> & { startsAt: Date }): Ag {
  n++;
  return {
    id: `a${n}`,
    code: `C${n}`,
    endsAt: new Date(+p.startsAt + 2 * 3600000),
    status: "completed",
    clientId: "c1",
    clientName: "Ana Souza",
    clientPhone: "11999990000",
    serviceName: "Extensão fio a fio",
    valueCents: 18000,
    professionalId: "p1",
    professionalName: "Tatiane",
    notes: "",
    ...p,
  };
}

describe("períodos no fuso do negócio", () => {
  it("usa o dia local de São Paulo, não o UTC", () => {
    // 27/11 às 23:30 em SP = 28/11 02:30 UTC
    const p = periodos(new Date("2026-11-28T02:30:00Z"), TZ);
    expect(p.today).toBe("2026-11-27");
    expect(p.mes).toBe("2026-11-01");
    expect(p.mesAnt).toBe("2026-10-01");
    expect(p.i0.toISOString()).toBe("2026-11-27T03:00:00.000Z");
  });
  it("vira o ano corretamente", () => {
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(daysInMonth("2028-02-01")).toBe(29);
  });
});

describe("faturamento e custo médio", () => {
  const now = new Date("2026-11-20T15:00:00Z");
  const p = periodos(now, TZ);
  const ags = [
    ag({ startsAt: new Date("2026-10-05T13:00:00Z"), valueCents: 20000 }),
    ag({ startsAt: new Date("2026-10-12T13:00:00Z"), valueCents: 10000 }),
    ag({ startsAt: new Date("2026-11-03T13:00:00Z"), valueCents: 15000 }),
    ag({ startsAt: new Date("2026-11-04T13:00:00Z"), valueCents: 9999, status: "confirmed" }),
    ag({ startsAt: new Date("2026-11-05T13:00:00Z"), valueCents: 9999, status: "no_show" }),
  ];
  it("só conta atendimentos concluídos", () => {
    expect(faturamento(ags, p.m0, p.m1)).toBe(15000);
    expect(faturamento(ags, p.mp, p.m0)).toBe(30000);
  });
  it("custo médio = despesas do mês passado ÷ atendimentos concluídos no mês passado", () => {
    const desp = [
      { id: "d1", description: "Aluguel", category: "aluguel", amountCents: 80000, spentOn: "2026-10-01" },
      { id: "d2", description: "Cola", category: "insumos", amountCents: 6000, spentOn: "2026-11-02" },
    ];
    expect(custoMedio(ags, desp, p)).toBe(40000);
  });
});

describe("clientes para chamar de volta", () => {
  const now = new Date("2026-11-27T15:00:00Z");
  it("extensão: avisa depois de 21 dias sem manutenção", () => {
    const l = sumidas([ag({ startsAt: new Date(+now - 25 * DAY) })], now);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ nome: "Ana Souza", dias: 25, extensao: true });
  });
  it("não avisa quem já tem horário marcado", () => {
    const l = sumidas([ag({ startsAt: new Date(+now - 40 * DAY) }), ag({ startsAt: new Date(+now + 2 * DAY), status: "confirmed" })], now);
    expect(l).toHaveLength(0);
  });
  it("sobrancelha: usa o intervalo médio da cliente (mínimo 21 dias)", () => {
    const base = { serviceName: "Design de sobrancelhas", clientId: "c2", clientName: "Bia" };
    const visitas = [70, 40, 10].map((d) => ag({ ...base, startsAt: new Date(+now - d * DAY) }));
    expect(sumidas(visitas, now)).toHaveLength(0); // média de 30 dias, última há 10
    const atrasada = [100, 70, 40].map((d) => ag({ ...base, startsAt: new Date(+now - d * DAY) }));
    expect(sumidas(atrasada, now)[0]).toMatchObject({ nome: "Bia", dias: 40, extensao: false });
  });
});

describe("respostas calculadas", () => {
  const now = new Date("2026-11-27T15:00:00Z");
  const r = resumoNegocio({
    ags: [ag({ startsAt: new Date("2026-11-10T13:00:00Z") }), ag({ startsAt: new Date("2026-11-27T17:00:00Z"), status: "confirmed", clientName: "Carla" })],
    desp: [],
    estoque: [{ id: "i1", name: "Cola 3 ml", unit: "frasco", quantity: 1, minimum: 2 }],
    totalClientes: 2,
    horario: { dias: ["Ter", "Qua"], ini: "09:00", fim: "19:00" },
    now,
    tz: TZ,
  });
  it("entende perguntas sobre estoque", () => {
    expect(respostaLocal("o que está acabando?", r)).toContain("Cola 3 ml: 1 frasco (mínimo 2)");
  });
  it("lista quem vem hoje", () => {
    expect(respostaLocal("Quem vem hoje?", r)).toContain("14:00 Carla");
  });
  it("resume o mês com volume e financeiro", () => {
    const t = respostaLocal("Como foi meu mês?", r);
    expect(t).toContain("Em novembro você fez 1 atendimento");
    expect(t).toContain("entrou R$");
  });
});

describe("conhecimento de lash", () => {
  it("reconhece extensões e o que separar", () => {
    expect(ehExtensao("Volume russo")).toBe(true);
    expect(ehExtensao("Remoção de extensão")).toBe(false);
    expect(ehExtensao("Design de sobrancelhas")).toBe(false);
    expect(separar("Manutenção (até 21 dias)")).toContain("mapping");
    expect(separar("Lash lifting")).toContain("lifting");
  });
  it("plural das unidades e valores negativos", () => {
    expect(unidade("frasco", 2)).toBe("frascos");
    expect(unidade("par", 30)).toBe("pares");
    expect(unidade("un", 3)).toBe("un");
    expect(brl(-4400)).toBe("−⁠R$ 44,00");
  });
});

describe("texto do horário da vitrine", async () => {
  const { resumoHorario, textoHorario } = await import("./horario");
  const h = (wd: number, s: number, e: number) => ({ weekday: wd, startMinute: s * 60, endMinute: e * 60 });
  it("junta dias seguidos com o mesmo horário", () => {
    expect(textoHorario(resumoHorario([2, 3, 4, 5, 6].map((d) => h(d, 9, 19))))).toBe("de terça a sábado, das 9h às 19h");
  });
  it("mostra separado o dia que fecha mais cedo", () => {
    const rows = [...[1, 2, 3, 4, 5].flatMap((d) => [h(d, 9, 12), h(d, 13, 19)]), h(6, 9, 15)];
    const r = resumoHorario(rows);
    expect(r.uniforme).toBe(false);
    expect(textoHorario(r)).toBe("de segunda a sexta, das 9h às 19h; sábado, das 9h às 15h");
  });
});
