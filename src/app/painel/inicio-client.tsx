"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { MessageCircle, SendHorizontal, Sparkles, X } from "lucide-react";
import { btn, cx } from "@/components/app";
import { CopyButton, toast, useStored, writeStored } from "@/components/app-client";
import { changeStatusAction } from "./agenda/actions";
import { askIaAction } from "./ia-actions";

type Status = "pending" | "confirmed" | "completed" | "cancelled_by_client" | "cancelled_by_business" | "no_show";

const FEITO: Record<string, string> = {
  confirmed: "Horário confirmado",
  completed: "Atendimento concluído",
  cancelled_by_business: "Agendamento cancelado",
  no_show: "Marcado como falta",
};

/** Muda o status e atualiza a tela. */
export function useStatus() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (id: string, status: Status, opts: { confirm?: string } = {}) => {
    if (opts.confirm && !window.confirm(opts.confirm)) return;
    start(async () => {
      const r = await changeStatusAction({ id, status });
      if (!r.ok) {
        toast(r.error, true);
        return;
      }
      toast(FEITO[status] ?? "Atualizado");
      router.refresh();
    });
  };
  return { run, pending };
}

export function waLink(tel: string) {
  let d = tel.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return `https://wa.me/${d}`;
}

export function PedidoActions({ id, tel }: { id: string; tel?: string }) {
  const { run, pending } = useStatus();
  return (
    <div className="flex items-center gap-2">
      <button type="button" disabled={pending} className={btn.miniOk} onClick={() => run(id, "confirmed")}>Aceitar</button>
      <button type="button" disabled={pending} className={btn.mini} onClick={() => run(id, "cancelled_by_business", { confirm: "Recusar este pedido? A cliente será avisada." })}>Recusar</button>
      {tel && (
        <a className="inline-flex size-9 items-center justify-center rounded-full border border-line-2 bg-white" href={waLink(tel)} target="_blank" rel="noopener" aria-label="Conversar no WhatsApp">
          <MessageCircle size={16} />
        </a>
      )}
    </div>
  );
}

export function ConcluirButton({ id }: { id: string }) {
  const { run, pending } = useStatus();
  return (
    <button type="button" disabled={pending} className={btn.miniOk} onClick={() => run(id, "completed")}>Concluir</button>
  );
}

/* ------------------------------------------------------------------ */
/* Faça agora                                                           */
/* ------------------------------------------------------------------ */

export type Sugestao = {
  id: string;
  tag: string;
  titulo: string;
  texto: string;
  acoes: ({ kind: "link"; label: string; href: string; primary?: boolean } | { kind: "copy"; label: string; text: string })[];
};

const CHAVE = "tbl-dispensadas";

export function FacaAgora({ itens }: { itens: Sugestao[] }) {
  const guardado = useStored(CHAVE);
  const [todas, setTodas] = useState(false);
  if (guardado === null) return null;
  let fora: string[] = [];
  try {
    fora = JSON.parse(guardado || "[]");
  } catch {}
  const vis = itens.filter((i) => !fora.includes(i.id));
  if (!vis.length) return null;
  const dispensar = (id: string) => writeStored(CHAVE, JSON.stringify([...fora, id].slice(-200)));
  const lista = todas ? vis : vis.slice(0, 3);
  return (
    <section aria-labelledby="faca-agora">
      <div className="mt-8 mb-3 flex items-baseline justify-between gap-3">
        <h2 id="faca-agora" className="text-[19px] font-bold">Faça agora</h2>
        {vis.length > 3 && (
          <button type="button" className={btn.text} onClick={() => setTodas(!todas)}>{todas ? "Ver menos" : `Ver todas (${vis.length})`}</button>
        )}
      </div>
      <div className="space-y-3">
        {lista.map((s) => (
          <article key={s.id} className="relative rounded-[22px] border border-line bg-white p-4 pr-12">
            <span className="inline-flex rounded-full bg-gel px-2.5 py-[3px] text-[12px] font-semibold text-gel-ink">{s.tag}</span>
            <button type="button" onClick={() => dispensar(s.id)} aria-label="Agora não" className="absolute top-2.5 right-2.5 inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-paper-2">
              <X size={17} />
            </button>
            <h3 className="mt-2.5 text-[16px] font-bold leading-snug">{s.titulo}</h3>
            <p className="mt-1 text-[14px] text-muted">{s.texto}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {s.acoes.map((a) =>
                a.kind === "copy" ? (
                  <CopyButton key={a.label} text={a.text} label={a.label} />
                ) : a.href.startsWith("/") ? (
                  <Link key={a.label} href={a.href} className={a.primary ? btn.miniOk : btn.mini}>{a.label}</Link>
                ) : (
                  <a key={a.label} href={a.href} target="_blank" rel="noopener" className={a.primary ? btn.miniOk : btn.mini}>{a.label}</a>
                ),
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pergunte à IA                                                        */
/* ------------------------------------------------------------------ */

const PERGUNTAS = [
  "Como foi meu mês?",
  "Quem vem hoje?",
  "Qual procedimento eu mais faço?",
  "O que está acabando no estoque?",
  "Quais clientes devo chamar de volta?",
];

type Msg = { p: string; r: string; ia: boolean };

export function PergunteIA() {
  const [q, setQ] = useState("");
  const [h, setH] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  const perguntar = async (texto: string) => {
    const pergunta = texto.trim();
    if (!pergunta || busy) return;
    setQ("");
    setBusy(true);
    const r = await askIaAction(pergunta, h.slice(-2).map((m) => ({ p: m.p, r: m.r })));
    setBusy(false);
    if (!r.ok) {
      toast(r.error, true);
      return;
    }
    setH((x) => [...x, { p: pergunta, r: r.resposta, ia: r.ia }]);
    setTimeout(() => fimRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  };

  return (
    <section aria-labelledby="pergunte-ia" className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="pergunte-ia" className="flex items-center gap-2 text-[19px] font-bold">
          <Sparkles size={18} /> Pergunte à IA
        </h2>
        {h.length > 0 && <button type="button" className={btn.text} onClick={() => setH([])}>Limpar</button>}
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {PERGUNTAS.map((x) => (
          <button key={x} type="button" disabled={busy} onClick={() => perguntar(x)} className="min-h-10 shrink-0 rounded-full border border-line-2 bg-white px-4 text-[13px] font-semibold hover:border-rimel">
            {x}
          </button>
        ))}
      </div>
      {h.length > 0 && (
        <div className="mt-4 flex flex-col gap-2.5" aria-live="polite">
          {h.slice(-6).map((m, i) => (
            <div key={i} className="flex flex-col gap-2.5">
              <div className="max-w-[85%] self-end rounded-[20px] rounded-br-md bg-rimel px-4 py-2.5 text-[14px] text-white">{m.p}</div>
              <div className="max-w-[92%] self-start rounded-[20px] rounded-bl-md bg-white px-4 py-3 text-[14px] whitespace-pre-wrap border border-line">
                {m.r}
                <span className="mt-2 block text-[12px] font-medium text-muted">{m.ia ? "Resposta da IA com os dados da sua conta" : "Calculado pelo app com os seus dados"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {busy && <p className="mt-3 text-[14px] text-muted">Pensando…</p>}
      <div ref={fimRef} />
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          perguntar(q);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pergunte sobre agenda, caixa, estoque…"
          enterKeyHint="send"
          className="min-h-[52px] flex-1 rounded-2xl border border-line-2 bg-white px-4 text-[16px] focus:border-rimel focus:outline-none"
          aria-label="Sua pergunta"
        />
        <button type="submit" disabled={busy || !q.trim()} className={cx("inline-flex size-[52px] shrink-0 items-center justify-center rounded-2xl bg-rimel text-white disabled:opacity-40")} aria-label="Enviar pergunta">
          <SendHorizontal size={20} />
        </button>
      </form>
      <p className="mt-2 text-[13px] text-muted">A IA usa só os dados da sua conta. Ela informa e sugere; nada muda na agenda sem você confirmar.</p>
    </section>
  );
}

export function BemVinda({ link }: { link: string }) {
  return (
    <div className="mt-5 rounded-[24px] border-[1.5px] border-rimel bg-white p-5">
      <p className="text-[17px] font-bold">Seu espaço está pronto</p>
      <p className="mt-1 text-[14px] text-ink-2">Mande o seu link para as clientes. Os pedidos de horário aparecem aqui para você aceitar ou recusar.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={link} className={btn.miniOk} />
        <a className={btn.mini} target="_blank" rel="noopener" href={`https://wa.me/?text=${encodeURIComponent(`Agende seu horário comigo: ${link}`)}`}>Enviar no WhatsApp</a>
      </div>
    </div>
  );
}
