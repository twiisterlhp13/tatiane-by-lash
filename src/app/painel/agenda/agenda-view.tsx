"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarPlus, CalendarRange, Ban, MessageCircle, X } from "lucide-react";
import { Group, Label, TimeCell, btn, inputCls } from "@/components/app";
import { Sheet, toast } from "@/components/app-client";
import { useStatus } from "../inicio-client";
import { novoAgendamentoAction } from "./novo-actions";

export type ItemAgenda = {
  id: string;
  dia: string;
  hora: string;
  fim: string;
  data: string;
  cliente: string;
  tel: string;
  servico: string;
  valor: string;
  profissional: string;
  comecou: boolean;
};

type Servico = { id: string; nome: string; precoCents: number; duracao: number; profissionais: string[] };

function wa(tel: string) {
  let d = tel.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return `https://wa.me/${d}`;
}

function Linha({ a, children }: { a: ItemAgenda; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <TimeCell time={a.hora} sub={a.fim} />
      <Link href={`/painel/agendamentos/${a.id}`} className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold">{a.cliente}</p>
        <p className="truncate text-[13px] text-muted">{a.servico}, {a.valor}{a.profissional ? `, com ${a.profissional}` : ""}</p>
      </Link>
      {children}
    </div>
  );
}

export function AgendaView({ pedidos, paraConcluir, proximos, abrirNovo, hoje, dataInicial, servicos, profissionais, minhaProfissional, clientes }: {
  pedidos: ItemAgenda[];
  paraConcluir: ItemAgenda[];
  proximos: ItemAgenda[];
  abrirNovo: boolean;
  hoje: string;
  dataInicial?: string;
  servicos: Servico[];
  profissionais: { id: string; nome: string }[];
  minhaProfissional: string | null;
  clientes: { id: string; nome: string; tel: string }[];
}) {
  const router = useRouter();
  const { run, pending } = useStatus();
  const [novo, setNovo] = useState(abrirNovo);
  useEffect(() => {
    if (abrirNovo) router.replace("/painel/agenda", { scroll: false });
  }, [abrirNovo, router]);

  const porDia = useMemo(() => {
    const m = new Map<string, ItemAgenda[]>();
    for (const a of proximos) m.set(a.dia, [...(m.get(a.dia) ?? []), a]);
    return [...m.entries()];
  }, [proximos]);

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-[28px] font-bold leading-tight">Agenda</h1>
        <div className="flex gap-2">
          <Link href="/painel/agenda/semana" className={btn.mini}><CalendarRange size={15} /> Semana</Link>
          <Link href="/painel/agenda/semana?bloquear=1" className={btn.mini}><Ban size={15} /> Bloquear</Link>
        </div>
      </div>

      {pedidos.length > 0 && (
        <>
          <h2 className="mt-7 mb-3 text-[19px] font-bold">Pedidos de horário</h2>
          <Group>
            {pedidos.map((a) => (
              <div key={a.id} className="px-4 py-3.5">
                <div className="flex items-center gap-3.5">
                  <TimeCell time={a.hora} sub={a.data} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold">{a.cliente}</p>
                    <p className="truncate text-[13px] text-muted">{a.servico}, {a.valor}</p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2 pl-[72px]">
                  <button type="button" disabled={pending} className={btn.miniOk} onClick={() => run(a.id, "confirmed")}>Aceitar</button>
                  <button type="button" disabled={pending} className={btn.mini} onClick={() => run(a.id, "cancelled_by_business", { confirm: "Recusar este pedido? A cliente será avisada." })}>Recusar</button>
                  {a.tel && (
                    <a className="inline-flex size-9 items-center justify-center rounded-full border border-line-2 bg-white" href={wa(a.tel)} target="_blank" rel="noopener" aria-label={`WhatsApp de ${a.cliente}`}>
                      <MessageCircle size={16} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </Group>
        </>
      )}

      {paraConcluir.length > 0 && (
        <>
          <h2 id="para-concluir" className="mt-7 mb-1 scroll-mt-24 text-[19px] font-bold">Para concluir</h2>
          <p className="mb-3 text-[13px] text-muted">Já passaram. Concluir conta no faturamento; falta fica no histórico da cliente.</p>
          <Group>
            {paraConcluir.map((a) => (
              <div key={a.id} className="px-4 py-3.5">
                <div className="flex items-center gap-3.5">
                  <TimeCell time={a.hora} sub={a.data} />
                  <Link href={`/painel/agendamentos/${a.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold">{a.cliente}</p>
                    <p className="truncate text-[13px] text-muted">{a.servico}, {a.valor}</p>
                  </Link>
                </div>
                <div className="mt-2.5 flex gap-2 pl-[72px]">
                  <button type="button" disabled={pending} className={btn.miniOk} onClick={() => run(a.id, "completed")}>Concluir</button>
                  <button type="button" disabled={pending} className={btn.mini} onClick={() => run(a.id, "no_show", { confirm: "Marcar que a cliente faltou?" })}>Faltou</button>
                </div>
              </div>
            ))}
          </Group>
        </>
      )}

      {porDia.length === 0 ? (
        <div className="mt-7 rounded-[22px] border border-dashed border-line-2 px-5 py-8 text-center">
          <p className="text-[14px] text-muted">Nenhum atendimento agendado. Toque no botão preto para criar o primeiro.</p>
        </div>
      ) : (
        porDia.map(([dia, lista]) => (
          <section key={dia}>
            <h2 className="mt-7 mb-3 text-[16px] font-bold text-ink-2">{dia}</h2>
            <Group>
              {lista.map((a) => (
                <Linha key={a.id} a={a}>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {a.tel && (
                      <a className="inline-flex size-10 items-center justify-center rounded-full border border-line-2 bg-white" href={wa(a.tel)} target="_blank" rel="noopener" aria-label={`WhatsApp de ${a.cliente}`}>
                        <MessageCircle size={17} />
                      </a>
                    )}
                    {a.comecou ? (
                      <button type="button" disabled={pending} className={btn.miniOk} onClick={() => run(a.id, "completed")}>Concluir</button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        className="inline-flex size-10 items-center justify-center rounded-full border border-line-2 bg-white text-ink-2 hover:border-danger hover:text-danger"
                        aria-label={`Cancelar o horário de ${a.cliente}`}
                        title="Cancelar"
                        onClick={() => run(a.id, "cancelled_by_business", { confirm: `Cancelar o horário de ${a.cliente}? A cliente será avisada.` })}
                      >
                        <X size={17} />
                      </button>
                    )}
                  </div>
                </Linha>
              ))}
            </Group>
          </section>
        ))
      )}

      <div className="h-24" aria-hidden="true" />

      <button
        type="button"
        onClick={() => setNovo(true)}
        className="fixed right-5 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-20 inline-flex size-[60px] items-center justify-center rounded-full bg-rimel text-white shadow-[0_10px_30px_rgb(0_0_0/0.25)] lg:right-[calc(50%-320px)]"
        aria-label="Novo agendamento"
      >
        <CalendarPlus size={24} />
      </button>

      <NovoAgendamento
        open={novo}
        onClose={() => setNovo(false)}
        hoje={hoje}
        dataInicial={dataInicial}
        servicos={servicos}
        profissionais={profissionais}
        minhaProfissional={minhaProfissional}
        clientes={clientes}
      />
    </div>
  );
}

function NovoAgendamento({ open, onClose, hoje, dataInicial, servicos, profissionais, minhaProfissional, clientes }: {
  open: boolean;
  onClose: () => void;
  hoje: string;
  dataInicial?: string;
  servicos: Servico[];
  profissionais: { id: string; nome: string }[];
  minhaProfissional: string | null;
  clientes: { id: string; nome: string; tel: string }[];
}) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [servicoId, setServicoId] = useState(servicos[0]?.id ?? "");
  const [data, setData] = useState(dataInicial ?? hoje);
  const [hora, setHora] = useState("");
  const [valor, setValor] = useState(servicos[0] ? String(servicos[0].precoCents / 100) : "");
  const [obs, setObs] = useState("");
  const servico = servicos.find((s) => s.id === servicoId);
  const prosDoServico = profissionais.filter((p) => !servico || servico.profissionais.includes(p.id));
  const [profId, setProfId] = useState<string>("");
  const profissional = prosDoServico.find((p) => p.id === profId) ?? prosDoServico.find((p) => p.id === minhaProfissional) ?? prosDoServico[0];
  const existente = clientes.find((c) => c.nome.toLowerCase() === nome.trim().toLowerCase());

  const salvar = () => {
    if (!servico) return toast("Cadastre um procedimento na Vitrine.", true);
    if (!profissional) return toast("Nenhuma profissional faz este procedimento.", true);
    if (!hora) return toast("Escolha o horário.", true);
    const v = Number(valor.replace(",", "."));
    start(async () => {
      const r = await novoAgendamentoAction({
        clientId: existente?.id,
        clientName: nome.trim(),
        phone: existente ? "" : tel,
        serviceId: servico.id,
        professionalId: profissional.id,
        date: data,
        time: hora,
        priceCents: Number.isFinite(v) ? Math.round(v * 100) : servico.precoCents,
        notes: obs,
      });
      if (!r.ok) return toast(r.error, true);
      toast("Agendamento salvo");
      setNome(""); setTel(""); setHora(""); setObs("");
      onClose();
      router.refresh();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Novo agendamento"
      footer={
        <div className="flex gap-2">
          <button type="button" className={btn.secondary.replace("w-full", "w-auto")} onClick={onClose}>Cancelar</button>
          <button type="button" className={btn.primary} disabled={saving} onClick={salvar}>{saving ? "Salvando…" : "Salvar agendamento"}</button>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <label className="block">
          <Label>Cliente</Label>
          <input className={inputCls} list="lista-clientes" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da cliente" autoComplete="off" />
          <datalist id="lista-clientes">
            {clientes.slice(0, 800).map((c) => <option key={c.id} value={c.nome} />)}
          </datalist>
          {existente && <span className="mt-1 block text-[12px] text-muted">Cliente já cadastrada{existente.tel ? `, WhatsApp ${existente.tel}` : ""}.</span>}
        </label>
        {!existente && (
          <label className="block">
            <Label hint="(opcional)">WhatsApp da cliente</Label>
            <input className={inputCls} type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="(11) 90000-0000" />
          </label>
        )}
        <label className="block">
          <Label>Procedimento</Label>
          <select
            className={inputCls}
            value={servicoId}
            onChange={(e) => {
              setServicoId(e.target.value);
              const s = servicos.find((x) => x.id === e.target.value);
              if (s) setValor(String(s.precoCents / 100));
            }}
          >
            {servicos.length ? servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>) : <option value="">Cadastre um procedimento na Vitrine</option>}
          </select>
        </label>
        {prosDoServico.length > 1 && (
          <label className="block">
            <Label>Profissional</Label>
            <select className={inputCls} value={profissional?.id ?? ""} onChange={(e) => setProfId(e.target.value)}>
              {prosDoServico.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <Label>Dia</Label>
            <input className={inputCls} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="block">
            <Label>Horário</Label>
            <input className={inputCls} type="time" step={300} value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <Label>Valor (R$)</Label>
          <input className={inputCls} type="number" inputMode="decimal" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
        </label>
        <label className="block">
          <Label hint="(só você vê)">Observação</Label>
          <input className={inputCls} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: mapping 9-10-11, curvatura D" />
        </label>
      </div>
    </Sheet>
  );
}
