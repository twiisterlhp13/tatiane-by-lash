/** Conhecimento do dia a dia de uma lash designer (cílios e sobrancelhas). Sem dependência de servidor. */

export const ESPECIALIDADES = [
  "Fio a fio",
  "Volume brasileiro",
  "Volume russo",
  "Mega volume",
  "Efeito molhado",
  "Lash lifting",
  "Design de sobrancelhas",
  "Henna",
  "Brow lamination",
  "Micropigmentação",
];

export const CATEGORIAS_DESPESA = ["insumos", "aluguel", "marketing", "impostos", "outros"] as const;
export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number];
export const CATEGORIA_LABEL: Record<string, string> = {
  insumos: "Insumos",
  aluguel: "Aluguel",
  marketing: "Marketing",
  impostos: "Impostos",
  outros: "Outros",
};

/** Sugestões para o cadastro (passo "Seus procedimentos e valores"). */
export const SERVICOS_SUGERIDOS = [
  { nome: "Extensão fio a fio", preco: "180", horas: "2" },
  { nome: "Volume brasileiro", preco: "200", horas: "2" },
  { nome: "Manutenção (até 21 dias)", preco: "120", horas: "1.5" },
  { nome: "Design de sobrancelhas", preco: "50", horas: "0.5" },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Extensões precisam de manutenção a cada 15–21 dias. */
export function ehExtensao(servico: string) {
  return /fio a fio|volume|mega|molhad|hibrid|extens|manuten|classic|yy|capping/.test(norm(servico)) && !/remoc/.test(norm(servico));
}

/** O que separar antes da próxima cliente, pelo nome do procedimento. */
export function separar(servico: string) {
  const n = norm(servico);
  if (/remoc/.test(n)) return "Removedor em creme, patches de gel e escovinhas";
  if (/manuten/.test(n)) return "Fios no mapping da cliente, cola, primer, removedor em gel e patches";
  if (/russo|mega/.test(n)) return "Fios 0,05 para leques, cola de secagem rápida, primer e patches";
  if (/brasileir|yy|volume/.test(n)) return "Fios YY 0,07, cola, primer e patches de gel";
  if (/fio a fio|classic|extens/.test(n)) return "Fios 0,15 nas curvaturas C e D, cola, primer e patches";
  if (/lifting|lash lift/.test(n)) return "Kit de lifting (etapas 1 a 3), escudos de silicone e tintura";
  if (/lamina/.test(n)) return "Kit de brow lamination, escovinha e nutrição";
  if (/henna/.test(n)) return "Henna, lápis de mapeamento e pinça";
  if (/micro/.test(n)) return "Dermógrafo, pigmentos, anestésico e luvas";
  if (/sobrancelha|design/.test(n)) return "Pinça, linha de mapeamento e lápis";
  return "Patches de gel, escovinhas, cola e primer";
}

/** "2 frascos", "1 frasco", "3 pares", "5 un" */
export function unidade(u: string, n: number) {
  return n === 1 || u === "un" ? u : u === "par" ? "pares" : /[aeiou]$/.test(u) ? `${u}s` : u;
}

export function primeiroNome(nome: string) {
  return (nome || "").trim().split(/\s+/)[0] || "";
}

/** Mensagens prontas de WhatsApp, no tom da Tatiane. */
export const msg = {
  confirmar: (nome: string, quando: string, hora: string, servico: string) =>
    `Oi, ${primeiroNome(nome)}! Passando para confirmar seu horário ${quando} às ${hora} (${servico}). Te espero!`,
  voltar: (nome: string, servico: string, extensao: boolean) =>
    extensao
      ? `Oi, ${primeiroNome(nome)}! Já está na hora da manutenção dos seus cílios (${servico}). Quer que eu reserve um horário essa semana?`
      : `Oi, ${primeiroNome(nome)}! Já faz um tempinho desde o seu ${servico}. Que tal marcar de novo? Tenho horários essa semana.`,
  aniversario: (nome: string) =>
    `Feliz aniversário, ${primeiroNome(nome)}! Que seu novo ciclo seja lindo. Para comemorar, seu próximo atendimento tem um mimo especial. Beijos!`,
  divulgar: (qtd: number, link: string) =>
    `Abri ${qtd} ${qtd === 1 ? "horário" : "horários"} para amanhã! Cílios e sobrancelhas com hora marcada: ${link}`,
};
