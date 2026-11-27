"use server";

import { and, count, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { perguntarIA } from "@/lib/ia";
import { periodos, respostaLocal, resumoNegocio } from "@/lib/negocio";
import { loadAgs, loadDespesas, loadEstoque, loadHorario } from "@/lib/painel-data";

/** Perguntas respondidas pela IA por mês, por negócio. Depois disso o app responde com os números calculados. */
const LIMITE_MES = 150;

export type RespostaIA = { ok: true; resposta: string; ia: boolean } | { ok: false; error: string };

export async function askIaAction(pergunta: string, historico: { p: string; r: string }[]): Promise<RespostaIA> {
  const q = (pergunta || "").trim().slice(0, 400);
  if (!q) return { ok: false, error: "Escreva sua pergunta." };
  const ctx = await requireCtx();
  try {
    const now = new Date();
    const tz = ctx.org.timezone;
    const p = periodos(now, tz);
    const [ags, desp, estoque, horario, [{ n: totalClientes }], [{ n: usadas }]] = await Promise.all([
      loadAgs(ctx, { pastDays: 400, futureDays: 60 }),
      loadDespesas(ctx.org.id, p.mesAnt),
      loadEstoque(ctx.org.id),
      loadHorario(ctx.org.id, ctx.professionalId),
      db.select({ n: count() }).from(schema.clients).where(eq(schema.clients.organizationId, ctx.org.id)),
      db.select({ n: count() }).from(schema.aiQuestions).where(and(eq(schema.aiQuestions.organizationId, ctx.org.id), eq(schema.aiQuestions.source, "ia"), gte(schema.aiQuestions.createdAt, p.m0))),
    ]);
    const resumo = resumoNegocio({ ags, desp, estoque, totalClientes, horario: { dias: horario.dias, ini: horario.ini, fim: horario.fim }, now, tz });
    const hist = (historico || []).slice(-2).map((m) => ({ p: String(m.p).slice(0, 400), r: String(m.r).slice(0, 1500) }));

    let resposta: string | null = null;
    let nota = "";
    if (usadas < LIMITE_MES) {
      resposta = await perguntarIA({
        pergunta: q,
        historico: hist,
        resumo,
        negocio: ctx.org.name,
        hoje: now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz }),
      });
    } else {
      nota = "\n\n(Você usou todas as perguntas de IA do mês; esta resposta foi calculada pelo app.)";
    }
    const ia = !!resposta;
    const final = resposta ?? respostaLocal(q, resumo) + nota;
    await db.insert(schema.aiQuestions).values({ organizationId: ctx.org.id, userId: ctx.user.id, question: q, answer: final.slice(0, 4000), source: ia ? "ia" : "local" });
    return { ok: true, resposta: final, ia };
  } catch (e) {
    console.error("[ia] erro", e);
    return { ok: false, error: "Não consegui responder agora. Tente de novo em instantes." };
  }
}
