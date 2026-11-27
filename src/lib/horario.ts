/** Horário de atendimento: resumo e texto para a vitrine (funções puras). */
import { minutesToHHMM } from "./time";

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function resumoHorario(rows: { weekday: number; startMinute: number; endMinute: number }[]) {
  const dias = [...new Set(rows.map((r) => r.weekday))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const ini = rows.length ? Math.min(...rows.map((r) => r.startMinute)) : null;
  const fim = rows.length ? Math.max(...rows.map((r) => r.endMinute)) : null;
  // pausa: espaço entre dois intervalos do mesmo dia (ex.: almoço), pelo dia mais comum
  let pausa: { ini: number; fim: number } | null = null;
  for (const d of dias) {
    const l = rows.filter((r) => r.weekday === d).sort((a, b) => a.startMinute - b.startMinute);
    if (l.length >= 2) {
      pausa = { ini: l[0].endMinute, fim: l[1].startMinute };
      break;
    }
  }
  // janela (início–fim) de cada dia, para descrever dias com horários diferentes
  const janelas = dias.map((d) => {
    const l = rows.filter((r) => r.weekday === d);
    return { weekday: d, ini: Math.min(...l.map((r) => r.startMinute)), fim: Math.max(...l.map((r) => r.endMinute)), n: l.length };
  });
  const uniforme = janelas.every((j) => j.ini === janelas[0].ini && j.fim === janelas[0].fim && j.n === janelas[0].n);
  return {
    weekdays: dias,
    janelas,
    uniforme,
    dias: dias.map((d) => DIAS_CURTOS[d]),
    ini: ini === null ? null : minutesToHHMM(ini),
    fim: fim === null ? null : minutesToHHMM(fim),
    iniMin: ini,
    fimMin: fim,
    pausa: pausa && pausa.fim > pausa.ini ? { ini: minutesToHHMM(pausa.ini), fim: minutesToHHMM(pausa.fim) } : null,
  };
}

const NOMES_DIA = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
const hhMin = (m: number) => (m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${Math.floor(m / 60)}h`);

function textoDias(ordem: number[]) {
  const lista = ordem.map((d) => NOMES_DIA[d]);
  const seguidos = ordem.every((d, i) => i === 0 || d === ordem[i - 1] + 1);
  if (seguidos && ordem.length > 2) return `de ${lista[0]} a ${lista[lista.length - 1]}`;
  return lista.length > 1 ? `${lista.slice(0, -1).join(", ")} e ${lista[lista.length - 1]}` : lista[0];
}

/** "de terça a sábado, das 9h às 19h" ou, com horários diferentes, "de segunda a sexta, das 9h às 19h; sábado, das 9h às 15h" */
export function textoHorario(h: { janelas: { weekday: number; ini: number; fim: number }[] }) {
  if (!h.janelas.length) return "";
  const ordem = [...h.janelas].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7));
  const grupos: { dias: number[]; ini: number; fim: number }[] = [];
  for (const j of ordem) {
    const g = grupos.find((x) => x.ini === j.ini && x.fim === j.fim);
    if (g) g.dias.push((j.weekday + 6) % 7);
    else grupos.push({ dias: [(j.weekday + 6) % 7], ini: j.ini, fim: j.fim });
  }
  return grupos.map((g) => `${textoDias(g.dias)}, das ${hhMin(g.ini)} às ${hhMin(g.fim)}`).join("; ");
}
