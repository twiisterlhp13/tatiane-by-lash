import "server-only";
import type { Resumo } from "./negocio";

const MODELO = process.env.IA_MODELO || "anthropic/claude-haiku-5.5";

async function credencial(): Promise<string | null> {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  try {
    const { getVercelOidcToken } = await import("@vercel/functions/oidc");
    return await getVercelOidcToken();
  } catch {
    return null;
  }
}

/** Troca centavos por reais para a IA ler os números sem confusão. */
function paraReais(r: Resumo) {
  const R = (c: number) => Math.round(c) / 100;
  return {
    ...r,
    fin: Object.fromEntries(Object.entries(r.fin).map(([k, v]) => [k, R(v)])),
    agenda: {
      hoje: r.agenda.hoje.map((x) => ({ ...x, valor: R(x.valor) })),
      semana: r.agenda.semana.map((x) => ({ ...x, valor: R(x.valor) })),
      pendentes: r.agenda.pendentes.map((x) => ({ ...x, valor: R(x.valor) })),
    },
    clientes: { ...r.clientes, top: r.clientes.top.map((x) => ({ ...x, total: R(x.total) })) },
  };
}

/**
 * Pergunta à IA (Vercel AI Gateway). Devolve null quando a IA não está disponível,
 * e o app responde com os números calculados.
 */
export async function perguntarIA(args: { pergunta: string; historico: { p: string; r: string }[]; resumo: Resumo; negocio: string; hoje: string }) {
  const token = await credencial();
  if (!token) return null;
  const sistema =
    `Você é a assistente do app de agenda de ${args.negocio}, lash designer (extensão de cílios, lash lifting e sobrancelhas). ` +
    `Hoje é ${args.hoje}. Responda em português do Brasil, em até 6 linhas curtas, com tom simpático e direto. ` +
    `Use apenas os dados do JSON abaixo (valores em reais, status: confirmed = confirmado, completed = concluído, pending = pedido aguardando resposta). ` +
    `Se a informação não estiver nos dados, diga isso. Você informa e sugere; não altera nada na agenda. ` +
    `Quando fizer sentido, sugira uma ação prática (chamar cliente no WhatsApp, divulgar horários, repor material).\n\nDADOS:\n` +
    JSON.stringify(paraReais(args.resumo));
  const messages = [
    { role: "system", content: sistema },
    ...args.historico.slice(-2).flatMap((m) => [
      { role: "user", content: m.p },
      { role: "assistant", content: m.r },
    ]),
    { role: "user", content: args.pergunta },
  ];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODELO, messages, max_tokens: 500, temperature: 0.3 }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn("[ia] gateway respondeu", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const txt = j.choices?.[0]?.message?.content?.trim();
    return txt || null;
  } catch (e) {
    console.warn("[ia] falhou", (e as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
