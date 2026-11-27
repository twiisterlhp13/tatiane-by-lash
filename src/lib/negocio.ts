/**
 * Cálculos do negócio (sem acesso ao banco): faturamento, custo médio, clientes para chamar,
 * resumo para a IA e respostas calculadas. Mesma lógica do "Hoje" e do "Pergunte à IA".
 */
import { ehExtensao, unidade } from "./lash";
import { addDays, fmtTime, localToUtc, toLocalDate, utcToLocalParts, type LocalDate } from "./time";

export type Ag = {
  id: string;
  code: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  /** valor líquido (preço − desconto) */
  valueCents: number;
  professionalId: string;
  professionalName: string;
  notes: string;
};

export type Despesa = { id: string; description: string; category: string; amountCents: number; spentOn: LocalDate };
export type ItemEstoque = { id: string; name: string; unit: string; quantity: number; minimum: number };

const DAY = 86400000;
const ATIVOS = ["pending", "confirmed"];

/* Datas no fuso do negócio ------------------------------------------------ */

export function monthStart(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}
export function addMonths(monthStartDate: LocalDate, n: number): LocalDate {
  const [y, m] = monthStartDate.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
export function daysInMonth(monthStartDate: LocalDate) {
  const [y, m] = monthStartDate.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function mesNome(monthStartDate: LocalDate, opts: Intl.DateTimeFormatOptions = { month: "long" }) {
  const [y, m] = monthStartDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("pt-BR", { ...opts, timeZone: "UTC" });
}

export type Periodos = {
  today: LocalDate;
  i0: Date; // início de hoje
  i1: Date; // início de amanhã
  m0: Date; // início do mês
  m1: Date; // início do próximo mês
  mp: Date; // início do mês passado
  mes: LocalDate;
  mesAnt: LocalDate;
  diaMes: number;
  diasMes: number;
};

export function periodos(now: Date, tz: string): Periodos {
  const today = toLocalDate(now, tz);
  const mes = monthStart(today);
  const prox = addMonths(mes, 1);
  const mesAnt = addMonths(mes, -1);
  return {
    today,
    i0: localToUtc(today, 0, tz),
    i1: localToUtc(addDays(today, 1), 0, tz),
    m0: localToUtc(mes, 0, tz),
    m1: localToUtc(prox, 0, tz),
    mp: localToUtc(mesAnt, 0, tz),
    mes,
    mesAnt,
    diaMes: Number(today.slice(8, 10)),
    diasMes: daysInMonth(mes),
  };
}

/* Faturamento e custos ---------------------------------------------------- */

export function concluidos(ags: Ag[], a: Date, b: Date) {
  return ags.filter((x) => x.status === "completed" && x.startsAt >= a && x.startsAt < b);
}
export function soma(l: { valueCents: number }[]) {
  return l.reduce((t, x) => t + x.valueCents, 0);
}
/** Faturamento = atendimentos concluídos no período. */
export function faturamento(ags: Ag[], a: Date, b: Date) {
  return soma(concluidos(ags, a, b));
}
export function despesasEntre(desp: Despesa[], a: LocalDate, b: LocalDate) {
  return desp.filter((d) => d.spentOn >= a && d.spentOn < b).reduce((t, d) => t + d.amountCents, 0);
}
/** Custo médio por atendimento: despesas do mês passado ÷ atendimentos concluídos no mês passado. */
export function custoMedio(ags: Ag[], desp: Despesa[], p: Periodos) {
  const n = concluidos(ags, p.mp, p.m0).length;
  const d = despesasEntre(desp, p.mesAnt, p.mes);
  return n ? Math.round(d / n) : 0;
}

/* Clientes para chamar de volta --------------------------------------------- */

export type Sumida = { clientId: string; nome: string; tel: string; dias: number; servico: string; extensao: boolean };

export function sumidas(ags: Ag[], now: Date): Sumida[] {
  const porCliente = new Map<string, Ag[]>();
  for (const a of ags) {
    if (a.status !== "completed") continue;
    const l = porCliente.get(a.clientId) ?? [];
    l.push(a);
    porCliente.set(a.clientId, l);
  }
  const comFuturo = new Set(ags.filter((a) => ATIVOS.includes(a.status) && a.startsAt > now).map((a) => a.clientId));
  const out: Sumida[] = [];
  for (const [id, l] of porCliente) {
    if (comFuturo.has(id)) continue;
    l.sort((x, y) => +x.startsAt - +y.startsAt);
    const u = l[l.length - 1];
    const dias = Math.round((+now - +u.startsAt) / DAY);
    const extensao = ehExtensao(u.serviceName);
    let lim = 45;
    if (extensao) lim = 21;
    else if (l.length > 1) {
      let g = 0;
      for (let i = 1; i < l.length; i++) g += (+l[i].startsAt - +l[i - 1].startsAt) / DAY;
      lim = Math.max(21, g / (l.length - 1));
    }
    if (dias > lim) out.push({ clientId: id, nome: u.clientName, tel: u.clientPhone, dias, servico: u.serviceName, extensao });
  }
  return out.sort((a, b) => b.dias - a.dias);
}

/* Resumo do negócio (base das respostas da IA) -------------------------------- */

const DSEM = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export type Resumo = ReturnType<typeof resumoNegocio>;

export function resumoNegocio(args: {
  ags: Ag[];
  desp: Despesa[];
  estoque: ItemEstoque[];
  totalClientes: number;
  horario: { dias: string[]; ini: string | null; fim: string | null };
  now: Date;
  tz: string;
}) {
  const { ags, desp, estoque, now, tz } = args;
  const p = periodos(now, tz);
  const s1 = localToUtc(addDays(p.today, 8), 0, tz);
  const cm = concluidos(ags, p.m0, p.m1);
  const cp = concluidos(ags, p.mp, p.m0);
  const u90 = concluidos(ags, new Date(+p.i0 - 90 * DAY), p.i1);
  const ranking = (l: Ag[], f: (a: Ag) => string) => {
    const o = new Map<string, number>();
    for (const x of l) {
      const k = f(x);
      if (k) o.set(k, (o.get(k) ?? 0) + 1);
    }
    return [...o.entries()].sort((a, b) => b[1] - a[1]);
  };
  const gasto = new Map<string, { nome: string; total: number }>();
  for (const x of ags) {
    if (x.status !== "completed") continue;
    const g = gasto.get(x.clientId) ?? { nome: x.clientName, total: 0 };
    g.total += x.valueCents;
    gasto.set(x.clientId, g);
  }
  const item = (a: Ag) => ({
    hora: fmtTime(a.startsAt, tz),
    dia: a.startsAt.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", timeZone: tz }),
    cliente: a.clientName,
    servico: a.serviceName,
    valor: a.valueCents,
    status: a.status,
  });
  const hoje = ags.filter((a) => ["confirmed", "completed"].includes(a.status) && a.startsAt >= p.i0 && a.startsAt < p.i1).sort((a, b) => +a.startsAt - +b.startsAt);
  const semana = ags.filter((a) => a.status === "confirmed" && a.startsAt >= p.i1 && a.startsAt < s1).sort((a, b) => +a.startsAt - +b.startsAt);
  return {
    mes: mesNome(p.mes),
    mesAnt: mesNome(p.mesAnt),
    diaMes: p.diaMes,
    diasMes: p.diasMes,
    horario: args.horario,
    volume: {
      mes: cm.length,
      mesAnt: cp.length,
      clientesMes: new Set(cm.map((x) => x.clientId)).size,
      servicos: ranking(cm.length ? cm : u90, (x) => x.serviceName).slice(0, 3),
      base: cm.length ? ("mes" as const) : ("90dias" as const),
      diasSemana: ranking(u90, (x) => DSEM[utcToLocalParts(x.startsAt, tz).weekday]).slice(0, 2),
    },
    fin: {
      fat: soma(cm),
      fatAnt: soma(cp),
      desp: despesasEntre(desp, p.mes, addMonths(p.mes, 1)),
      despAnt: despesasEntre(desp, p.mesAnt, p.mes),
      ticket: cm.length ? Math.round(soma(cm) / cm.length) : 0,
      previsto: soma(ags.filter((a) => a.status === "confirmed" && a.startsAt >= now && a.startsAt < p.m1)),
    },
    agenda: {
      hoje: hoje.map(item),
      semana: semana.map(item),
      pendentes: ags.filter((a) => a.status === "pending" && a.startsAt >= now).map(item),
    },
    estoque: {
      total: estoque.length,
      baixo: estoque.filter((i) => i.quantity <= i.minimum).map((i) => ({ nome: i.name, qtd: i.quantity, un: i.unit, min: i.minimum })),
    },
    clientes: {
      total: args.totalClientes,
      top: [...gasto.values()].sort((a, b) => b.total - a.total).slice(0, 3),
      sumidas: sumidas(ags, now).slice(0, 3).map((c) => ({ nome: c.nome, dias: c.dias, servico: c.servico })),
    },
  };
}

/* Respostas calculadas pelo app (quando a IA não responde) ---------------------- */

export function brl(cents: number) {
  const s = (Math.abs(cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  // sinal de menos que não se separa do valor na quebra de linha
  return cents < 0 ? `−\u2060${s}` : s;
}
const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
const lista = (a: string[]) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " e " + a[a.length - 1]);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function rVolume(r: Resumo) {
  const v = r.volume;
  let t = `Em ${r.mes} você fez ${v.mes} atendimento${v.mes === 1 ? "" : "s"}` + (v.clientesMes ? ` para ${v.clientesMes} cliente${v.clientesMes === 1 ? "" : "s"}` : "") + ".";
  if (v.mesAnt) t += ` Em ${r.mesAnt} ${v.mesAnt === 1 ? "foi 1" : "foram " + v.mesAnt}` + (r.diaMes < r.diasMes ? " (o mês atual ainda não acabou)." : ".");
  if (v.servicos.length) {
    t += `\nProcedimento que mais sai${v.base === "mes" ? " no mês" : " nos últimos 90 dias"}: ${v.servicos[0][0]} (${v.servicos[0][1]}x)`;
    if (v.servicos.length > 1) t += `, depois ${lista(v.servicos.slice(1).map((s) => `${s[0]} (${s[1]}x)`))}`;
    t += ".";
  }
  if (v.diasSemana.length) t += `\nDia que mais lota: ${v.diasSemana[0][0]}` + (v.diasSemana[1] ? `, seguido de ${v.diasSemana[1][0]}` : "") + ".";
  return t;
}

export function rFin(r: Resumo) {
  const f = r.fin;
  const luc = f.fat - f.desp;
  const p = pct(f.fat, f.fatAnt);
  let t = `${cap(r.mes)} até agora: entrou ${brl(f.fat)}, saiu ${brl(f.desp)} em despesas, lucro de ${brl(luc)}.`;
  if (f.ticket) t += `\nTicket médio: ${brl(f.ticket)} por atendimento.`;
  if (f.fatAnt) t += `\nEm ${r.mesAnt} o faturamento fechou em ${brl(f.fatAnt)}` + (p !== null ? `; você está em ${p >= 0 ? "+" : ""}${p}% do total do mês passado.` : ".");
  if (f.previsto) t += `\nAinda tem ${brl(f.previsto)} agendados até o fim do mês.`;
  return t;
}

export function rAgenda(r: Resumo) {
  const a = r.agenda;
  let t = a.hoje.length
    ? `Hoje: ${a.hoje.length} atendimento${a.hoje.length > 1 ? "s" : ""}.\n` +
      a.hoje.map((x) => `• ${x.hora} ${x.cliente} (${x.servico}, ${brl(x.valor)})${x.status === "completed" ? " ✓" : ""}`).join("\n")
    : "Hoje você não tem atendimento marcado.";
  if (a.semana.length) {
    t += `\nPróximos dias:\n` + a.semana.slice(0, 5).map((x) => `• ${x.dia}, ${x.hora}: ${x.cliente} (${x.servico})`).join("\n");
    if (a.semana.length > 5) t += `\n…e mais ${a.semana.length - 5}.`;
  } else t += "\nNos próximos 7 dias a agenda está livre: bom momento para divulgar horários.";
  if (a.pendentes.length) t += `\n${a.pendentes.length} pedido${a.pendentes.length > 1 ? "s" : ""} de horário esperando sua resposta.`;
  return t;
}

export function rEstoque(r: Resumo) {
  const e = r.estoque;
  if (!e.total) return "Você ainda não cadastrou itens no estoque. Em Negócio › Estoque, cadastre fios, cola, primer, removedor e patches com a quantidade mínima.";
  if (!e.baixo.length) return `Estoque em dia: nenhum dos ${e.total} itens está abaixo do mínimo.`;
  return `Repor ${e.baixo.length} ${e.baixo.length > 1 ? "itens" : "item"}:\n` + e.baixo.map((i) => `• ${i.nome}: ${i.qtd} ${unidade(i.un, i.qtd)} (mínimo ${i.min})`).join("\n");
}

export function rClientes(r: Resumo) {
  const c = r.clientes;
  let t = `Você tem ${c.total} cliente${c.total === 1 ? "" : "s"} cadastrada${c.total === 1 ? "" : "s"}.`;
  if (c.sumidas.length) {
    t += `\nPara chamar de volta:\n` + c.sumidas.map((x) => `• ${x.nome}: ${x.dias} dias sem vir (última: ${x.servico})`).join("\n");
    t += `\nNo Início, em "Faça agora", a mensagem de WhatsApp já está pronta.`;
  } else t += "\nNenhuma cliente sumida no momento.";
  if (c.top.length) t += `\nQuem mais gastou com você: ${lista(c.top.map((x) => `${x.nome} (${brl(x.total)})`))}.`;
  return t;
}

export function respostaLocal(q: string, r: Resumo) {
  const n = (q || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const o: ((r: Resumo) => string)[] = [];
  if (/estoq|acaba|repor|fio|cola|primer|patch|materia|insumo|falt/.test(n)) o.push(rEstoque);
  if (/client|recuper|sumid|chamar|volta|fiel|quem mais|manuten/.test(n)) o.push(rClientes);
  if (/agenda|hoje|amanha|semana|horario|livre|proxim|marcad|pedido|quem vem/.test(n)) o.push(rAgenda);
  if (/quant[ao]s (atendi|client|servic|procedi|trabalho)|volume|atendimento|servico|procedimento|movimento|lota|dia da semana|mais faco|mais sai/.test(n)) o.push(rVolume);
  if (/fatur|dinheiro|lucr|ganh|entrou|receit|despes|gastei|ticket|financ|caixa|grana|meta/.test(n)) o.push(rFin);
  if (/como (foi|esta|vai) (o |meu )?mes|resumo|balanco/.test(n)) {
    if (!o.includes(rVolume)) o.push(rVolume);
    if (!o.includes(rFin)) o.push(rFin);
  }
  if (!o.length) return rAgenda(r) + "\n\n" + rFin(r) + "\n\n" + rEstoque(r) + "\n\nPosso detalhar agenda, volume de atendimentos, financeiro, estoque ou clientes.";
  return o.map((f) => f(r)).join("\n\n");
}
