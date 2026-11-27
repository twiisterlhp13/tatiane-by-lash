import { requireCtx } from "@/lib/auth";
import { CATEGORIA_LABEL } from "@/lib/lash";
import { addMonths, brl, despesasEntre, faturamento, mesNome, periodos } from "@/lib/negocio";
import { loadAgs, loadDespesas, loadEstoque } from "@/lib/painel-data";
import { localToUtc } from "@/lib/time";
import { NegocioView } from "./negocio-view";

export const metadata = { title: "Negócio" };

export default async function NegocioPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const tz = ctx.org.timezone;
  const p = periodos(new Date(), tz);
  const podeFinanceiro = ctx.can("reports.view");
  const inicio = addMonths(p.mes, -5);
  const [ags, desp, estoque] = await Promise.all([
    podeFinanceiro ? loadAgs(ctx, { pastDays: 190, futureDays: 0 }) : Promise.resolve([]),
    podeFinanceiro ? loadDespesas(ctx.org.id, inicio) : Promise.resolve([]),
    loadEstoque(ctx.org.id),
  ]);

  const meses = [5, 4, 3, 2, 1, 0].map((o) => {
    const ini = addMonths(p.mes, -o);
    const fim = addMonths(ini, 1);
    const fat = faturamento(ags, localToUtc(ini, 0, tz), localToUtc(fim, 0, tz));
    const des = despesasEntre(desp, ini, fim);
    return { rotulo: mesNome(ini, { month: "short" }).replace(".", ""), fat, des };
  });
  const atual = meses[meses.length - 1];
  const concluidosMes = ags.filter((a) => a.status === "completed" && a.startsAt >= p.m0 && a.startsAt < p.m1).length;

  return (
    <NegocioView
      abaInicial={sp.aba === "estoque" || !podeFinanceiro ? "estoque" : "financeiro"}
      podeFinanceiro={podeFinanceiro}
      hoje={p.today}
      mesAtual={mesNome(p.mes)}
      kpis={{
        fat: brl(atual.fat),
        des: brl(atual.des),
        luc: brl(atual.fat - atual.des),
        lucNegativo: atual.fat - atual.des < 0,
        ticket: concluidosMes ? brl(Math.round(atual.fat / concluidosMes)) : null,
        atendimentos: concluidosMes,
      }}
      meses={meses.map((m) => ({ rotulo: m.rotulo, fat: m.fat, fatTxt: brl(m.fat) }))}
      despesas={desp.slice(0, 12).map((d) => ({
        id: d.id,
        descricao: d.description,
        categoria: CATEGORIA_LABEL[d.category] ?? d.category,
        data: `${d.spentOn.slice(8, 10)}/${d.spentOn.slice(5, 7)}`,
        valor: brl(d.amountCents),
      }))}
      estoque={estoque}
    />
  );
}
