"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Group, Label, btn, cx, inputCls } from "@/components/app";
import { Segmented, toast } from "@/components/app-client";
import { CATEGORIAS_DESPESA, CATEGORIA_LABEL, unidade } from "@/lib/lash";
import { addDespesaAction, addItemAction, changeQtyAction, deleteDespesaAction, deleteItemAction } from "./actions";

type Aba = "financeiro" | "estoque";
type Item = { id: string; name: string; unit: string; quantity: number; minimum: number };

export function NegocioView({ abaInicial, podeFinanceiro, hoje, mesAtual, kpis, meses, despesas, estoque }: {
  abaInicial: Aba;
  podeFinanceiro: boolean;
  hoje: string;
  mesAtual: string;
  kpis: { fat: string; des: string; luc: string; lucNegativo: boolean; ticket: string | null; atendimentos: number };
  meses: { rotulo: string; fat: number; fatTxt: string }[];
  despesas: { id: string; descricao: string; categoria: string; data: string; valor: string }[];
  estoque: Item[];
}) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  return (
    <div>
      <h1 className="text-[28px] font-bold leading-tight">Meu negócio</h1>
      {podeFinanceiro && (
        <Segmented<Aba>
          value={aba}
          onChange={(v) => {
            setAba(v);
            window.history.replaceState(null, "", v === "estoque" ? "/painel/negocio?aba=estoque" : "/painel/negocio");
          }}
          options={[{ value: "financeiro", label: "Financeiro" }, { value: "estoque", label: "Estoque" }]}
        />
      )}
      {aba === "financeiro" && podeFinanceiro ? (
        <Financeiro hoje={hoje} mesAtual={mesAtual} kpis={kpis} meses={meses} despesas={despesas} />
      ) : (
        <Estoque itens={estoque} />
      )}
    </div>
  );
}

function Financeiro({ hoje, mesAtual, kpis, meses, despesas }: {
  hoje: string;
  mesAtual: string;
  kpis: { fat: string; des: string; luc: string; lucNegativo: boolean; ticket: string | null; atendimentos: number };
  meses: { rotulo: string; fat: number; fatTxt: string }[];
  despesas: { id: string; descricao: string; categoria: string; data: string; valor: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIAS_DESPESA)[number]>("insumos");
  const [data, setData] = useState(hoje);
  const max = Math.max(...meses.map((m) => m.fat), 1);

  return (
    <div>
      <p className="mt-5 text-[14px] font-semibold text-muted">Em {mesAtual}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[
          { l: "Faturamento", v: kpis.fat },
          { l: "Despesas", v: kpis.des },
          { l: "Lucro", v: kpis.luc, neg: kpis.lucNegativo },
        ].map((k) => (
          <div key={k.l} className="min-w-0 rounded-[18px] border border-line bg-white px-2.5 py-3">
            <p className="text-[12px] font-medium text-muted">{k.l}</p>
            <p className={cx("tnum mt-0.5 text-[15px] font-bold leading-tight whitespace-nowrap", k.neg && "text-danger")}>{k.v}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-muted">
        Faturamento = atendimentos concluídos no mês{kpis.atendimentos ? ` (${kpis.atendimentos}, ticket médio de ${kpis.ticket})` : ""}.
      </p>

      <h2 className="mt-8 mb-3 text-[19px] font-bold">Últimos 6 meses</h2>
      <div className="flex h-[170px] items-end gap-2 rounded-[22px] border border-line bg-white px-3 pt-4 pb-3">
        {meses.map((m, i) => (
          <div key={m.rotulo + i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="tnum text-[10.5px] font-semibold text-ink-2">{m.fat ? m.fatTxt.replace(/,\d\d$/, "") : ""}</span>
            <span
              className={cx("w-full max-w-[38px] rounded-t-[10px]", i === meses.length - 1 ? "bg-rimel" : "bg-gel-2")}
              style={{ height: `${Math.max(3, Math.round((m.fat / max) * 100))}px` }}
            />
            <span className="text-[12px] font-medium text-muted capitalize">{m.rotulo}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-[19px] font-bold">Despesas</h2>
      {despesas.length ? (
        <Group>
          {despesas.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{d.descricao}</p>
                <p className="text-[13px] text-muted">{d.categoria}, {d.data}</p>
              </div>
              <span className="tnum text-[15px] font-bold">{d.valor}</span>
              <button
                type="button"
                disabled={pending}
                aria-label={`Apagar despesa ${d.descricao}`}
                className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-paper-2"
                onClick={() => {
                  if (!confirm(`Apagar a despesa "${d.descricao}"?`)) return;
                  start(async () => {
                    const r = await deleteDespesaAction(d.id);
                    if (!r.ok) return toast(r.error, true);
                    toast("Despesa apagada");
                    router.refresh();
                  });
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </Group>
      ) : (
        <p className="rounded-[22px] border border-dashed border-line-2 px-5 py-6 text-center text-[14px] text-muted">Nenhuma despesa lançada. Lance aluguel, materiais e anúncios para ver o lucro de verdade.</p>
      )}

      <form
        className="mt-4 rounded-[22px] border border-line bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const v = Number(valor.replace(",", "."));
          start(async () => {
            const r = await addDespesaAction({ description: desc, amount: v, category: cat, date: data });
            if (!r.ok) return toast(r.error, true);
            toast("Despesa salva");
            setDesc("");
            setValor("");
            router.refresh();
          });
        }}
      >
        <p className="text-[16px] font-bold">Nova despesa</p>
        <label className="mt-3 block">
          <Label>Descrição</Label>
          <input className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Fios 0,07 e cola" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <Label>Valor (R$)</Label>
            <input className={inputCls} type="number" inputMode="decimal" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
          </label>
          <label className="block">
            <Label>Categoria</Label>
            <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
              {CATEGORIAS_DESPESA.map((c) => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-3 block">
          <Label>Data</Label>
          <input className={inputCls} type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <button type="submit" className={btn.primary + " mt-4"} disabled={pending || !desc.trim() || !valor}>Salvar despesa</button>
      </form>
    </div>
  );
}

const UNIDADES = ["un", "frasco", "caixa", "bandeja", "pacote", "par"];


function Estoque({ itens }: { itens: Item[] }) {
  const router = useRouter();
  const [lista, setLista] = useState(itens);
  const [pending, start] = useTransition();
  const [nome, setNome] = useState("");
  const [qtd, setQtd] = useState("");
  const [min, setMin] = useState("");
  const [un, setUn] = useState("un");
  if (itens !== lista && itens.length !== lista.length) setLista(itens);

  const mudar = (id: string, delta: number) => {
    setLista((l) => l.map((i) => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)));
    changeQtyAction(id, delta).then((r) => {
      if (!r.ok) {
        toast(r.error, true);
        router.refresh();
      }
    });
  };

  return (
    <div>
      <p className="mt-5 text-[14px] text-muted">Atualize as quantidades conforme usa. Quando um item chega ao mínimo, ele aparece em “Faça agora”, no Início.</p>
      {lista.length ? (
        <Group className="mt-4">
          {lista.map((i) => {
            const baixo = i.quantity <= i.minimum;
            return (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{i.name}</p>
                  <p className={cx("text-[13px]", baixo ? "font-semibold text-danger" : "text-muted")}>
                    {baixo ? "Repor, " : ""}mínimo {i.minimum} {unidade(i.unit, i.minimum)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" className="inline-flex size-9 items-center justify-center rounded-full border border-line-2" aria-label={`Diminuir ${i.name}`} onClick={() => mudar(i.id, -1)}>
                    <Minus size={16} />
                  </button>
                  <span className="tnum w-9 text-center text-[16px] font-bold" aria-live="polite">{i.quantity}</span>
                  <button type="button" className="inline-flex size-9 items-center justify-center rounded-full border border-line-2" aria-label={`Aumentar ${i.name}`} onClick={() => mudar(i.id, 1)}>
                    <Plus size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label={`Apagar ${i.name}`}
                  className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-paper-2"
                  onClick={() => {
                    if (!confirm(`Apagar "${i.name}" do estoque?`)) return;
                    start(async () => {
                      const r = await deleteItemAction(i.id);
                      if (!r.ok) return toast(r.error, true);
                      setLista((l) => l.filter((x) => x.id !== i.id));
                      toast("Item apagado");
                      router.refresh();
                    });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </Group>
      ) : (
        <p className="mt-4 rounded-[22px] border border-dashed border-line-2 px-5 py-6 text-center text-[14px] text-muted">Nenhum item no estoque. Comece por fios, cola, primer, removedor e patches de gel.</p>
      )}

      <form
        className="mt-4 rounded-[22px] border border-line bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addItemAction({ name: nome, quantity: Number(qtd || 0), minimum: Number(min || 0), unit: un });
            if (!r.ok) return toast(r.error, true);
            toast("Item salvo");
            setNome("");
            setQtd("");
            setMin("");
            router.refresh();
          });
        }}
      >
        <p className="text-[16px] font-bold">Novo item</p>
        <label className="mt-3 block">
          <Label>Nome</Label>
          <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Cola 3 ml" />
        </label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <label className="block">
            <Label>Quantidade</Label>
            <input className={inputCls} type="number" inputMode="numeric" min="0" step="1" value={qtd} onChange={(e) => setQtd(e.target.value)} />
          </label>
          <label className="block">
            <Label>Mínimo</Label>
            <input className={inputCls} type="number" inputMode="numeric" min="0" step="1" value={min} onChange={(e) => setMin(e.target.value)} />
          </label>
          <label className="block">
            <Label>Unidade</Label>
            <select className={inputCls} value={un} onChange={(e) => setUn(e.target.value)}>
              {UNIDADES.map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
        </div>
        <button type="submit" className={btn.primary + " mt-4"} disabled={pending || !nome.trim()}>Salvar item</button>
      </form>
    </div>
  );
}
