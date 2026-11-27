"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AtSign, CalendarCheck, Clock4, MapPin, MessageCircle, Search, Store } from "lucide-react";
import { LashMark } from "@/components/brand";
import { Avatar, Label, STATUS_CLIENTE, Tag, btn, cx, inputCls } from "@/components/app";
import { Segmented, Sheet, toast, useIsClient } from "@/components/app-client";
import { clientCancelAction } from "./agendamento/actions";

type Perfil = { nome: string; foto: string | null; instagram: string; area: string; bio: string; whatsapp: string; especialidades: string[]; horario: string };
type Servico = { id: string; nome: string; descricao: string; duracao: string; preco: string; aPartir: boolean; profissionais: string[] };
type Foto = { id: string; src: string; legenda: string };
type Aba = "vitrine" | "meus";
type Guardado = { code: string; token: string };
type Meu = {
  code: string; status: string; servico: string; profissional: string; inicio: string; dia: string; hora: string; valor: string;
  ativo: boolean; podeCancelar: boolean; podeRemarcar: boolean; link: string;
};

const chaveMeus = (slug: string) => `tbl_meus_${slug}`;
function lerMeus(slug: string): Guardado[] {
  try {
    return JSON.parse(localStorage.getItem(chaveMeus(slug)) || "[]");
  } catch {
    return [];
  }
}
function guardarMeu(slug: string, g: Guardado) {
  try {
    const l = lerMeus(slug).filter((x) => x.code !== g.code);
    localStorage.setItem(chaveMeus(slug), JSON.stringify([g, ...l].slice(0, 40)));
  } catch {}
}
function wa(tel: string, texto?: string) {
  let d = tel.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

/** "TATIANE By Lash": primeira palavra forte, o resto leve (para nomes no formato "X by Y"). */
function NomeMarca({ nome, className }: { nome: string; className?: string }) {
  const m = /^(\S+)\s+(by\s+.+)$/i.exec(nome.trim());
  if (!m) return <span className={cx("font-extrabold", className)}>{nome}</span>;
  return (
    <span className={className}>
      <span className="font-extrabold tracking-[0.14em] uppercase">{m[1]}</span>
      <span className="ml-1.5 font-normal">{m[2].replace(/^by/i, "By")}</span>
    </span>
  );
}

export function ClienteApp(props: {
  slug: string;
  abaInicial: Aba;
  servicoInicial?: string;
  hoje: string;
  agendamentoOnline: boolean;
  confirmaNaHora: boolean;
  exigeEmail: boolean;
  politica: string;
  perfil: Perfil;
  servicos: Servico[];
  profissionais: { id: string; nome: string }[];
  fotos: Foto[];
}) {
  const { slug, perfil } = props;
  const [aba, setAba] = useState<Aba>(props.abaInicial);
  // id do procedimento pré-escolhido ("" = nenhum); null = folha fechada
  const [agendar, setAgendar] = useState<string | null>(() =>
    props.servicoInicial && props.servicos.some((s) => s.id === props.servicoInicial) ? props.servicoInicial : null,
  );
  const [versao, setVersao] = useState(0);
  const noNavegador = useIsClient();

  const trocar = (a: Aba) => {
    setAba(a);
    window.history.replaceState(null, "", a === "meus" ? `/${slug}?aba=meus` : `/${slug}`);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[640px] items-center gap-2 px-4 pt-[calc(12px+env(safe-area-inset-top,0px))] pb-3">
          <LashMark size={24} />
          <NomeMarca nome={perfil.nome} className="min-w-0 flex-1 truncate text-[15px]" />
          {perfil.whatsapp && (
            <a href={wa(perfil.whatsapp, `Olá! Vim pelo app de agendamento.`)} target="_blank" rel="noopener" className={btn.mini}>
              <MessageCircle size={15} /> WhatsApp
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-[calc(170px+env(safe-area-inset-bottom,0px))]">
        {aba === "vitrine" ? (
          <Vitrine {...props} onAgendar={(id) => setAgendar(id)} />
        ) : (
          <MeusHorarios slug={slug} versao={versao} onAgendar={() => { trocar("vitrine"); setAgendar(""); }} />
        )}
      </main>

      {aba === "vitrine" && props.agendamentoOnline && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] z-20 bg-gradient-to-t from-paper from-55% to-transparent px-4 pt-6 pb-3">
          <div className="mx-auto max-w-[640px]">
            <button type="button" className={btn.primary} onClick={() => setAgendar("")}>Agendar horário</button>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur" aria-label="Navegação">
        <div className="mx-auto flex max-w-[640px] pb-[env(safe-area-inset-bottom,0px)]">
          {([["vitrine", "Vitrine", Store], ["meus", "Meus horários", CalendarCheck]] as const).map(([v, l, Icon]) => (
            <button key={v} type="button" onClick={() => trocar(v)} aria-current={aba === v ? "page" : undefined}
              className={cx("flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold", aba === v ? "text-rimel" : "text-muted")}>
              <span className={cx("flex h-8 w-14 items-center justify-center rounded-full", aba === v && "bg-gel")}><Icon size={21} strokeWidth={aba === v ? 2.2 : 1.8} /></span>
              {l}
            </button>
          ))}
        </div>
      </nav>

      {agendar !== null && noNavegador && (
        <Agendar
          {...props}
          servicoId={agendar}
          onClose={() => setAgendar(null)}
          onFeito={() => {
            setAgendar(null);
            setVersao((v) => v + 1);
            trocar("meus");
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vitrine                                                              */
/* ------------------------------------------------------------------ */

function Vitrine({ perfil, servicos, fotos, politica, agendamentoOnline, onAgendar }: {
  perfil: Perfil; servicos: Servico[]; fotos: Foto[]; politica: string; agendamentoOnline: boolean; onAgendar: (id: string) => void;
}) {
  const [aba, setAba] = useState<"serv" | "port">("serv");
  const [ver, setVer] = useState<Foto | null>(null);
  return (
    <div>
      <section className="flex items-center gap-4">
        <Avatar name={perfil.nome} photo={perfil.foto} size={88} />
        <div className="min-w-0">
          <h1 className="text-[24px] leading-tight font-bold">{perfil.nome}</h1>
          {perfil.instagram && (
            <a href={`https://instagram.com/${perfil.instagram}`} target="_blank" rel="noopener" className="mt-1 flex items-center gap-1 text-[14px] font-semibold text-ink-2 hover:underline">
              <AtSign size={14} />{perfil.instagram}
            </a>
          )}
          {perfil.area && <p className="mt-0.5 flex items-center gap-1 text-[14px] text-ink-2"><MapPin size={14} />{perfil.area}</p>}
        </div>
      </section>
      {perfil.bio && <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{perfil.bio}</p>}
      {perfil.especialidades.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {perfil.especialidades.map((e) => <span key={e} className="rounded-full border border-gel-2 px-3 py-1 text-[12.5px] font-semibold text-gel-ink">{e}</span>)}
        </div>
      )}
      {perfil.horario && <p className="mt-4 flex items-center gap-2 text-[14px] text-ink-2"><Clock4 size={16} className="shrink-0" /> Atende {perfil.horario}</p>}

      {fotos.length > 0 ? (
        <Segmented value={aba} onChange={setAba} options={[{ value: "serv", label: "Procedimentos" }, { value: "port", label: `Portfólio (${fotos.length})` }]} />
      ) : (
        <h2 className="mt-8 text-[19px] font-bold">Procedimentos e valores</h2>
      )}

      {aba === "serv" || !fotos.length ? (
        <div className="mt-4 divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-white">
          {servicos.length ? servicos.map((s) => (
            <button key={s.id} type="button" disabled={!agendamentoOnline} onClick={() => onAgendar(s.id)} className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-paper disabled:hover:bg-white">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold">{s.nome}</p>
                {s.descricao && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{s.descricao}</p>}
                <p className="mt-1 text-[13px] text-ink-2">{s.duracao}</p>
              </div>
              <div className="shrink-0 text-right">
                {s.aPartir && <span className="block text-[11px] font-medium text-muted">a partir de</span>}
                <span className="tnum text-[16px] font-bold">{s.preco}</span>
              </div>
            </button>
          )) : <p className="px-4 py-6 text-center text-[14px] text-muted">Em breve os procedimentos aparecem aqui.</p>}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {fotos.map((f) => (
            <button key={f.id} type="button" onClick={() => setVer(f)} className="overflow-hidden rounded-[14px] bg-paper-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.src} alt={f.legenda || "Trabalho do portfólio"} loading="lazy" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {!agendamentoOnline && (
        <div className="mt-6 rounded-[22px] bg-gel p-5 text-gel-ink">
          <p className="text-[16px] font-bold">Agendamentos pelo WhatsApp</p>
          <p className="mt-1 text-[14px]">No momento os horários são combinados diretamente. Chame no WhatsApp que encontramos o melhor horário para você.</p>
          {perfil.whatsapp && <a className={btn.miniOk + " mt-3"} href={wa(perfil.whatsapp, "Olá! Gostaria de agendar um horário.")} target="_blank" rel="noopener">Chamar no WhatsApp</a>}
        </div>
      )}

      {politica && (
        <section className="mt-8">
          <h2 className="text-[16px] font-bold">Combinados</h2>
          <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-muted">{politica}</p>
        </section>
      )}
      <footer className="mt-8 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        <Link href="/termos" className="hover:underline">Termos de uso</Link>
        <Link href="/privacidade" className="hover:underline">Privacidade</Link>
      </footer>

      {ver && (
        <Sheet open onClose={() => setVer(null)} title={perfil.nome}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ver.src} alt={ver.legenda || "Trabalho do portfólio"} className="w-full rounded-[18px]" />
          {ver.legenda && <p className="mt-3 text-[14px] text-ink-2">{ver.legenda}</p>}
        </Sheet>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Agendar                                                              */
/* ------------------------------------------------------------------ */

type Dia = { date: string; slots: { start: string; time: string; professionalIds: string[] }[] };

const DSEM = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function Agendar({ slug, servicos, profissionais, servicoId, hoje, confirmaNaHora, exigeEmail, onClose, onFeito }: {
  slug: string;
  servicos: Servico[];
  profissionais: { id: string; nome: string }[];
  servicoId: string;
  hoje: string;
  confirmaNaHora: boolean;
  exigeEmail: boolean;
  onClose: () => void;
  onFeito: () => void;
}) {
  const [serv, setServ] = useState(servicoId || servicos[0]?.id || "");
  const servico = servicos.find((s) => s.id === serv);
  const pros = profissionais.filter((p) => servico?.profissionais.includes(p.id));
  const [prof, setProf] = useState<string>("any");
  const [dias, setDias] = useState<Dia[] | null>(null);
  const [erroDias, setErroDias] = useState("");
  const [dia, setDia] = useState<string>("");
  const [slot, setSlot] = useState<string>("");
  const salvo = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("tbl_cliente") || "null") as { nome?: string; tel?: string; email?: string; termos?: boolean } | null;
    } catch {
      return null;
    }
  }, []);
  const [nome, setNome] = useState(salvo?.nome ?? "");
  const [tel, setTel] = useState(salvo?.tel ?? "");
  const [email, setEmail] = useState(salvo?.email ?? "");
  const [obs, setObs] = useState("");
  const [termos, setTermos] = useState(!!salvo?.termos);
  const [novidades, setNovidades] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [chave] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()));

  // horários livres das próximas 4 semanas para o procedimento escolhido
  useEffect(() => {
    if (!serv) return;
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch(`/api/public/${slug}/disponibilidade?service=${serv}&prof=${prof}&from=${hoje}&days=28`, { cache: "no-store" });
        const j = await r.json();
        if (cancelado) return;
        if (!r.ok) throw new Error(j.error || "Não consegui carregar os horários.");
        const lista: Dia[] = j.days;
        setErroDias("");
        setDias(lista);
        setDia((d) => (lista.some((x) => x.date === d && x.slots.length) ? d : lista.find((x) => x.slots.length)?.date ?? ""));
      } catch (e) {
        if (cancelado) return;
        setErroDias((e as Error).message);
        setDias([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [serv, prof, slug, hoje, recarga]);

  const recarregar = () => {
    setDias(null);
    setSlot("");
    setRecarga((n) => n + 1);
  };

  const slotsDoDia = useMemo(() => dias?.find((d) => d.date === dia)?.slots ?? [], [dias, dia]);
  const temHorario = !!dias?.some((d) => d.slots.length);

  const pedir = async () => {
    if (!slot) return toast("Escolha um horário.", true);
    if (nome.trim().length < 2) return toast("Informe seu nome.", true);
    if (tel.replace(/\D/g, "").length < 10) return toast("Informe seu WhatsApp com DDD.", true);
    if (exigeEmail && !email.trim()) return toast("Informe seu e-mail.", true);
    if (!termos) return toast("Aceite os termos para continuar.", true);
    setEnviando(true);
    try {
      const r = await fetch(`/api/public/${slug}/agendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: serv, professionalId: prof, startsAt: slot, name: nome.trim(), phone: tel.trim(), email: email.trim(),
          notes: obs.trim(), acceptTerms: true, marketingConsent: novidades, idempotencyKey: chave, website: "",
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast(j.error || "Não foi possível pedir o horário.", true);
        if (r.status === 409) recarregar();
        return;
      }
      const token = j.manageUrl ? new URL(j.manageUrl, window.location.origin).searchParams.get("t") : null;
      if (token) guardarMeu(slug, { code: j.code, token });
      try { localStorage.setItem("tbl_cliente", JSON.stringify({ nome: nome.trim(), tel: tel.trim(), email: email.trim(), termos: true })); } catch {}
      toast(j.status === "confirmed" ? "Horário confirmado!" : "Pedido enviado! Aguarde a confirmação.");
      onFeito();
    } catch {
      toast("Sem conexão. Tente de novo.", true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Agendar horário"
      footer={
        <div>
          <button type="button" className={btn.primary} disabled={!slot || enviando} onClick={pedir}>
            {enviando ? "Enviando…" : confirmaNaHora ? "Confirmar horário" : "Pedir horário"}
          </button>
          {!confirmaNaHora && <p className="mt-2 text-center text-[12.5px] text-muted">A confirmação chega aqui, em Meus horários.</p>}
        </div>
      }
    >
      <div className="space-y-5 pt-1">
        <label className="block">
          <Label>Procedimento</Label>
          <select className={inputCls} value={serv} onChange={(e) => { setServ(e.target.value); setProf("any"); setDias(null); setSlot(""); }}>
            {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} ({s.aPartir ? "a partir de " : ""}{s.preco})</option>)}
          </select>
          {servico && <span className="mt-1 block text-[12.5px] text-muted">Duração: {servico.duracao}</span>}
        </label>

        {pros.length > 1 && (
          <label className="block">
            <Label>Com quem</Label>
            <select className={inputCls} value={prof} onChange={(e) => { setProf(e.target.value); setDias(null); setSlot(""); }}>
              <option value="any">Qualquer profissional</option>
              {pros.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
        )}

        <div>
          <Label>Dia</Label>
          {dias === null ? (
            <p className="py-3 text-[14px] text-muted">Buscando horários livres…</p>
          ) : erroDias ? (
            <p className="py-3 text-[14px] text-danger">{erroDias}</p>
          ) : !temHorario ? (
            <p className="rounded-2xl bg-paper-2 px-4 py-3 text-[14px] text-ink-2">Sem horários livres nas próximas semanas para este procedimento. Chame no WhatsApp que a gente encaixa.</p>
          ) : (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {dias.map((d) => {
                const [y, m, dd] = d.date.split("-").map(Number);
                const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
                const livre = d.slots.length > 0;
                const on = d.date === dia;
                return (
                  <button key={d.date} type="button" disabled={!livre} onClick={() => { setDia(d.date); setSlot(""); }}
                    aria-pressed={on}
                    className={cx("flex h-[68px] w-[54px] shrink-0 flex-col items-center justify-center rounded-2xl border text-[12px] font-semibold",
                      on ? "border-rimel bg-rimel text-white" : livre ? "border-line-2 bg-white" : "border-line bg-paper text-muted/60 line-through")}>
                    <span>{d.date === hoje ? "Hoje" : DSEM[wd]}</span>
                    <span className="text-[19px] font-bold">{dd}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {slotsDoDia.length > 0 && (
          <div>
            <Label>Horário</Label>
            <div className="grid grid-cols-4 gap-2">
              {slotsDoDia.map((s) => (
                <button key={s.start} type="button" onClick={() => setSlot(s.start)} aria-pressed={slot === s.start}
                  className={cx("min-h-11 rounded-xl border text-[15px] font-semibold tnum", slot === s.start ? "border-rimel bg-rimel text-white" : "border-line-2 bg-white hover:border-rimel")}>
                  {s.time}
                </button>
              ))}
            </div>
          </div>
        )}

        {slot && (
          <div className="space-y-4 border-t border-line pt-5">
            <p className="text-[16px] font-bold">Seus dados</p>
            <label className="block"><Label>Nome</Label><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></label>
            <label className="block"><Label>WhatsApp com DDD</Label><input className={inputCls} type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} autoComplete="tel" placeholder="(11) 90000-0000" /></label>
            <label className="block"><Label hint={exigeEmail ? undefined : "(opcional, para receber a confirmação)"}>E-mail</Label><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
            <label className="block"><Label hint="(opcional)">Recado para a profissional</Label><input className={inputCls} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: é minha primeira vez, tenho alergia a…" /></label>
            <label className="flex items-start gap-3 text-[14px] text-ink-2">
              <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-black" checked={termos} onChange={(e) => setTermos(e.target.checked)} />
              <span>Li e aceito os <Link href="/termos" target="_blank" className="font-semibold text-ink underline">termos</Link> e a <Link href="/privacidade" target="_blank" className="font-semibold text-ink underline">privacidade</Link>.</span>
            </label>
            <label className="flex items-start gap-3 text-[14px] text-ink-2">
              <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-black" checked={novidades} onChange={(e) => setNovidades(e.target.checked)} />
              <span>Quero receber novidades e horários vagos.</span>
            </label>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Meus horários                                                        */
/* ------------------------------------------------------------------ */

function MeusHorarios({ slug, versao, onAgendar }: { slug: string; versao: number; onAgendar: () => void }) {
  const [itens, setItens] = useState<Meu[] | null>(null);
  const [busy, setBusy] = useState("");
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const guardados = lerMeus(slug);
      let lista: Meu[] = [];
      if (guardados.length) {
        try {
          const r = await fetch(`/api/public/${slug}/meus`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: guardados }) });
          const j = await r.json();
          lista = r.ok ? j.items : [];
        } catch {
          toast("Sem conexão para carregar seus horários.", true);
        }
      }
      if (!cancelado) setItens(lista);
    })();
    return () => {
      cancelado = true;
    };
  }, [slug, versao, recarga]);

  const cancelar = async (m: Meu) => {
    if (!confirm(`Cancelar ${m.servico} de ${m.dia} às ${m.hora}?`)) return;
    const g = lerMeus(slug).find((x) => x.code === m.code);
    if (!g) return;
    setBusy(m.code);
    const r = await clientCancelAction({ slug, code: m.code, token: g.token, reason: "" });
    setBusy("");
    if (!r.ok) return toast(r.error, true);
    toast("Horário cancelado");
    setRecarga((n) => n + 1);
  };

  return (
    <div>
      <h1 className="text-[28px] leading-tight font-bold">Meus horários</h1>
      {itens === null ? (
        <p className="mt-6 text-[14px] text-muted">Carregando…</p>
      ) : itens.length === 0 ? (
        <div className="mt-6 rounded-[22px] border border-dashed border-line-2 px-5 py-8 text-center">
          <p className="text-[14px] text-muted">Você ainda não pediu nenhum horário por este aparelho.</p>
          <button type="button" className={btn.miniOk + " mt-4"} onClick={onAgendar}>Agendar horário</button>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-white">
          {itens.map((m) => {
            const st = STATUS_CLIENTE[m.status] ?? { label: m.status, tone: "neutral" as const };
            return (
              <div key={m.code} className={cx("px-4 py-4", !m.ativo && "opacity-70")}>
                <div className="flex items-start gap-3.5">
                  <div className="w-[58px] shrink-0 border-r border-line pr-3">
                    <div className="tnum text-[17px] leading-tight font-bold">{m.hora}</div>
                    <div className="text-[12px] text-muted capitalize">{m.dia}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold">{m.servico}</p>
                    <p className="text-[13px] text-muted">com {m.profissional}, {m.valor}</p>
                    <Tag tone={st.tone} className="mt-1.5">{st.label}</Tag>
                  </div>
                </div>
                {m.ativo && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 pl-[72px]">
                    {m.podeRemarcar && <Link href={m.link} className={btn.mini}>Remarcar</Link>}
                    {m.podeCancelar && <button type="button" disabled={busy === m.code} className={btn.mini} onClick={() => cancelar(m)}>Cancelar</button>}
                    <Link href={m.link} className={btn.text}>Detalhes</Link>
                  </div>
                )}
                {m.ativo && !m.podeCancelar && (
                  <p className="mt-2 pl-[72px] text-[12.5px] text-muted">O prazo para mudar pelo app já passou. Para remarcar ou cancelar, fale com a profissional pelo WhatsApp.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Link href={`/${slug}/meu-agendamento`} className="mt-5 flex items-center justify-center gap-2 text-[14px] font-semibold text-ink-2 hover:underline">
        <Search size={15} /> Pediu por outro aparelho? Buscar pelo código
      </Link>
    </div>
  );
}
