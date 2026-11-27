"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Label, btn, cx, inputCls } from "@/components/app";
import { Chips } from "@/components/app-client";
import { ESPECIALIDADES, SERVICOS_SUGERIDOS } from "@/lib/lash";
import { onboardingAction } from "../actions";

const DIAS = [
  { value: 1, label: "Seg" }, { value: 2, label: "Ter" }, { value: 3, label: "Qua" }, { value: 4, label: "Qui" },
  { value: 5, label: "Sex" }, { value: 6, label: "Sáb" }, { value: 0, label: "Dom" },
];
const DURACOES = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240];
const durTxt = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`);

type Servico = { nome: string; preco: string; minutos: number };

export function Onboarding() {
  const [passo, setPasso] = useState(1);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const [nome, setNome] = useState("");
  const [local, setLocal] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [termos, setTermos] = useState(false);
  const [esp, setEsp] = useState<string[]>([]);
  const [servicos, setServicos] = useState<Servico[]>(SERVICOS_SUGERIDOS.map((s) => ({ nome: s.nome, preco: "", minutos: Math.round(Number(s.horas) * 60) })));
  const [dias, setDias] = useState<number[]>([2, 3, 4, 5, 6]);
  const [ini, setIni] = useState("09:00");
  const [fim, setFim] = useState("19:00");

  const validos = servicos.filter((s) => s.nome.trim().length >= 2 && s.preco !== "" && Number(s.preco.replace(",", ".")) >= 0);

  const avancar = () => {
    let erro = "";
    if (passo === 1) {
      if (nome.trim().length < 2 || local.trim().length < 2) erro = "Informe seu nome profissional e o bairro/cidade.";
      else if (!/\S+@\S+\.\S+/.test(email)) erro = "Informe um e-mail válido.";
      else if (senha.length < 8) erro = "A senha precisa ter pelo menos 8 caracteres.";
      else if (!termos) erro = "É preciso aceitar os termos e a política de privacidade.";
    }
    if (passo === 3 && !validos.length) erro = "Cadastre pelo menos um procedimento com nome e valor.";
    if (passo === 4 && !dias.length) erro = "Escolha pelo menos um dia de atendimento.";
    setMsg(erro);
    if (erro) return;
    if (passo < 4) {
      setPasso(passo + 1);
      window.scrollTo(0, 0);
      return;
    }
    start(async () => {
      const r = await onboardingAction({
        nome, local, email, senha, termos: termos as true,
        especialidades: esp,
        servicos: validos.map((s) => ({ nome: s.nome.trim(), preco: Number(s.preco.replace(",", ".")), minutos: s.minutos })),
        dias, ini, fim,
      });
      if (r && !r.ok) {
        setMsg(r.error);
        setPasso(r.passo);
      }
    });
  };

  const longos = servicos.some((s) => s.minutos >= 120);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-6 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-44">
      <div className="flex items-center gap-4 py-2">
        {passo > 1 ? (
          <button type="button" className={btn.icon} aria-label="Voltar" onClick={() => { setMsg(""); setPasso(passo - 1); }}><ArrowLeft size={18} /></button>
        ) : (
          <Link href="/" className={btn.icon} aria-label="Voltar"><ArrowLeft size={18} /></Link>
        )}
        <div className="flex flex-1 gap-2" aria-label={`Passo ${passo} de 4`}>
          {[1, 2, 3, 4].map((i) => <i key={i} className={cx("h-1 flex-1 rounded-full", i <= passo ? "bg-rimel" : "bg-line-2")} />)}
        </div>
      </div>

      {passo === 1 && (
        <section>
          <h1 className="mt-8 text-[28px] leading-tight font-bold">Como suas clientes te conhecem?</h1>
          <div className="mt-6 space-y-4">
            <label className="block"><Label>Nome profissional</Label><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="organization" placeholder="Tatiane By Lash" /></label>
            <label className="block">
              <Label>Bairro e cidade</Label>
              <input className={inputCls} value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Tatuapé, São Paulo" />
              <span className="mt-1 block text-[12px] text-muted">Seu endereço exato nunca aparece no perfil público.</span>
            </label>
            <label className="block"><Label>E-mail de acesso</Label><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="voce@email.com" /></label>
            <label className="block"><Label hint="(mínimo 8 caracteres)">Senha</Label><input className={inputCls} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" /></label>
            <label className="flex items-start gap-3 text-[14px] text-ink-2">
              <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-black" checked={termos} onChange={(e) => setTermos(e.target.checked)} />
              <span>Li e aceito os <Link href="/termos" target="_blank" className="font-semibold text-ink underline">termos de uso</Link> e a <Link href="/privacidade" target="_blank" className="font-semibold text-ink underline">política de privacidade</Link>.</span>
            </label>
          </div>
        </section>
      )}

      {passo === 2 && (
        <section>
          <h1 className="mt-8 text-[28px] leading-tight font-bold">Quais são suas especialidades?</h1>
          <p className="mt-2 text-[15px] text-muted">Elas aparecem na sua vitrine.</p>
          <Chips className="mt-6" multiple options={ESPECIALIDADES.map((e) => ({ value: e, label: e }))} value={esp} onChange={setEsp} />
        </section>
      )}

      {passo === 3 && (
        <section>
          <h1 className="mt-8 text-[28px] leading-tight font-bold">Seus procedimentos e valores</h1>
          <p className="mt-2 text-[15px] text-muted">Deixei os mais comuns. Ajuste os nomes, preencha os valores e apague o que não faz.</p>
          <div className="mt-5 space-y-3">
            {servicos.map((s, i) => (
              <div key={i} className="rounded-[22px] border border-line bg-white p-4">
                <div className="flex gap-2">
                  <input className={inputCls} value={s.nome} placeholder="Ex.: Volume russo" aria-label="Nome do procedimento"
                    onChange={(e) => setServicos(servicos.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
                  <button type="button" className={btn.icon} aria-label="Apagar procedimento" onClick={() => setServicos(servicos.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input className={inputCls} type="number" inputMode="decimal" min="0" step="0.01" placeholder="Valor (R$)" aria-label="Valor" value={s.preco}
                    onChange={(e) => setServicos(servicos.map((x, j) => (j === i ? { ...x, preco: e.target.value } : x)))} />
                  <select className={inputCls} value={s.minutos} aria-label="Duração"
                    onChange={(e) => setServicos(servicos.map((x, j) => (j === i ? { ...x, minutos: Number(e.target.value) } : x)))}>
                    {DURACOES.map((d) => <option key={d} value={d}>{durTxt(d)}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="mt-3 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[22px] border border-dashed border-line-2 text-[15px] font-semibold" onClick={() => setServicos([...servicos, { nome: "", preco: "", minutos: 60 }])}>
            <Plus size={17} /> Adicionar procedimento
          </button>
        </section>
      )}

      {passo === 4 && (
        <section>
          <h1 className="mt-8 text-[28px] leading-tight font-bold">Quando você atende?</h1>
          <Chips className="mt-6" multiple options={DIAS} value={dias} onChange={setDias} />
          <div className="mt-5 grid grid-cols-2 gap-3 rounded-[22px] border border-line bg-white p-4">
            <label className="block"><Label>Início</Label><input className={inputCls} type="time" value={ini} onChange={(e) => setIni(e.target.value)} /></label>
            <label className="block"><Label>Fim</Label><input className={inputCls} type="time" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
          </div>
          <p className="mt-4 rounded-[18px] bg-gel px-4 py-3 text-[14px] text-gel-ink">
            {longos
              ? "Deixei 10 minutos entre um atendimento e outro para higienizar o material e preparar a maca. Você pode mudar depois."
              : "Você poderá ajustar seus horários e folgas depois, na Vitrine."}
          </p>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-paper from-60% to-transparent px-6 pt-8 pb-[calc(18px+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto max-w-md">
          {msg && <p role="alert" className="mb-3 rounded-2xl border-l-4 border-danger bg-white px-4 py-2.5 text-[14px] text-danger">{msg}</p>}
          <button type="button" className={btn.primary} disabled={pending} onClick={avancar}>
            {passo === 4 ? (pending ? "Criando seu espaço…" : "Pronto, entrar") : "Continuar"}
          </button>
          {passo === 1 && <Link href="/entrar" className={btn.text + " mt-1 w-full"}>Já tenho conta</Link>}
        </div>
      </div>
    </main>
  );
}
