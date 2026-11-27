"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AtSign, Camera, ChevronRight, Clock4, ExternalLink, ImagePlus, MapPin, MessageCircle, Pencil } from "lucide-react";
import { Avatar, Group, Label, btn, cx, inputCls } from "@/components/app";
import { Chips, CopyButton, Segmented, Sheet, shrinkImage, toast } from "@/components/app-client";
import { ESPECIALIDADES } from "@/lib/lash";
import { addFotoAction, apagarFotoAction, apagarServicoAction, salvarHorarioAction, salvarPerfilAction, salvarServicoAction } from "./actions";

type Perfil = { nome: string; foto: string | null; instagram: string; area: string; bio: string; whatsapp: string; especialidades: string[] };
type Horario = { weekdays: number[]; ini: string; fim: string; pausa: { ini: string; fim: string } | null; texto: string; uniforme: boolean };
type Servico = { id: string; nome: string; descricao: string; precoCents: number; preco: string; aPartir: boolean; minutos: number; duracao: string; online: boolean };
type Foto = { id: string; src: string; legenda: string };

const DIAS = [
  { value: 1, label: "Seg" }, { value: 2, label: "Ter" }, { value: 3, label: "Qua" }, { value: 4, label: "Qui" },
  { value: 5, label: "Sex" }, { value: 6, label: "Sáb" }, { value: 0, label: "Dom" },
];
const DURACOES = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240];
const durTxt = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`);

export function VitrineView({ podeEditar, podeServicos, link, slug, perfil, horario, servicos, fotos }: {
  podeEditar: boolean;
  podeServicos: boolean;
  link: string;
  slug: string;
  perfil: Perfil;
  horario: Horario;
  servicos: Servico[];
  fotos: Foto[];
}) {
  const [aba, setAba] = useState<"serv" | "port">("serv");
  const [editPerfil, setEditPerfil] = useState(false);
  const [editHorario, setEditHorario] = useState(false);

  return (
    <div>
      <h1 className="text-[28px] font-bold leading-tight">Minha vitrine</h1>

      <section className="mt-5 rounded-[28px] border border-line bg-white p-5">
        <div className="flex items-center gap-4">
          <Avatar name={perfil.nome} photo={perfil.foto} size={84} />
          <div className="min-w-0">
            <p className="text-[22px] font-bold leading-tight">{perfil.nome}</p>
            {perfil.instagram && <p className="mt-1 flex items-center gap-1 text-[14px] text-ink-2"><AtSign size={14} />{perfil.instagram}</p>}
            {perfil.area && <p className="mt-0.5 flex items-center gap-1 text-[14px] text-ink-2"><MapPin size={14} />{perfil.area}</p>}
          </div>
        </div>
        {perfil.bio ? <p className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-ink-2">{perfil.bio}</p> : podeEditar && <p className="mt-4 text-[14px] text-muted">Conte há quanto tempo atende e o que faz de melhor. Isso aparece para as clientes.</p>}
        {perfil.especialidades.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {perfil.especialidades.map((e) => <span key={e} className="rounded-full border border-gel-2 px-3 py-1 text-[12.5px] font-semibold text-gel-ink">{e}</span>)}
          </div>
        )}
        {podeEditar && (
          <button type="button" className={btn.secondary + " mt-5"} onClick={() => setEditPerfil(true)}>
            <Pencil size={16} /> Editar perfil
          </button>
        )}
      </section>

      <section className="mt-4 rounded-[22px] bg-gel p-4">
        <p className="text-[14px] font-bold text-gel-ink">Seu link de agendamento</p>
        <p className="mt-0.5 break-all text-[13px] text-gel-ink/80">{link.replace(/^https?:\/\//, "")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={link} />
          <a className={btn.mini} href={`https://wa.me/?text=${encodeURIComponent(`Agende seu horário comigo: ${link}`)}`} target="_blank" rel="noopener">
            <MessageCircle size={15} /> WhatsApp
          </a>
          <Link href={`/${slug}`} target="_blank" className={btn.mini}><ExternalLink size={15} /> Ver como cliente</Link>
        </div>
      </section>

      <button type="button" onClick={() => setEditHorario(true)} className="mt-4 flex w-full items-center gap-3 rounded-[22px] border border-line bg-white px-4 py-3.5 text-left hover:border-rimel">
        <Clock4 size={20} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">Horário de atendimento</span>
          <span className="block text-[13px] text-muted">{horario.texto ? horario.texto.charAt(0).toUpperCase() + horario.texto.slice(1) : "Defina os dias e horários em que atende"}{horario.pausa ? `. Pausa das ${horario.pausa.ini} às ${horario.pausa.fim}` : ""}</span>
        </span>
        <ChevronRight size={17} className="text-muted" />
      </button>

      <Segmented
        value={aba}
        onChange={setAba}
        options={[{ value: "serv", label: "Procedimentos" }, { value: "port", label: `Portfólio${fotos.length ? ` (${fotos.length})` : ""}` }]}
      />

      {aba === "serv" ? <Servicos servicos={servicos} pode={podeServicos} /> : <Portfolio fotos={fotos} pode={podeEditar} />}

      <PerfilSheet open={editPerfil} onClose={() => setEditPerfil(false)} perfil={perfil} />
      <HorarioSheet open={editHorario} onClose={() => setEditHorario(false)} horario={horario} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PerfilSheet({ open, onClose, perfil }: { open: boolean; onClose: () => void; perfil: Perfil }) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const [f, setF] = useState(perfil);
  const [foto, setFoto] = useState<string | null | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const extras = perfil.especialidades.filter((e) => !ESPECIALIDADES.includes(e));
  const opcoes = [...ESPECIALIDADES, ...extras].map((e) => ({ value: e, label: e }));
  const fotoAtual = foto === undefined ? perfil.foto : foto;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Editar perfil"
      footer={
        <button
          type="button"
          className={btn.primary}
          disabled={saving}
          onClick={() =>
            start(async () => {
              const r = await salvarPerfilAction({ name: f.nome, instagram: f.instagram, area: f.area, bio: f.bio, whatsapp: f.whatsapp, specialties: f.especialidades, photo: foto });
              if (!r.ok) return toast(r.error, true);
              toast("Perfil salvo");
              onClose();
              router.refresh();
            })
          }
        >
          {saving ? "Salvando…" : "Salvar perfil"}
        </button>
      }
    >
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-4">
          <Avatar name={f.nome} photo={fotoAtual} size={76} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn.mini} onClick={() => fileRef.current?.click()}><Camera size={15} /> {fotoAtual ? "Trocar foto" : "Pôr foto"}</button>
            {fotoAtual && <button type="button" className={btn.mini} onClick={() => setFoto(null)}>Tirar foto</button>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                setFoto(await shrinkImage(file, 400, true, 0.84));
              } catch (err) {
                toast((err as Error).message, true);
              }
              e.target.value = "";
            }}
          />
        </div>
        <label className="block">
          <Label>Nome na vitrine</Label>
          <input className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        </label>
        <label className="block">
          <Label hint="(sem @)">Instagram</Label>
          <input className={inputCls} value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} placeholder="tatianebylash" />
        </label>
        <label className="block">
          <Label>Bairro e cidade</Label>
          <input className={inputCls} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="Tatuapé, São Paulo" />
          <span className="mt-1 block text-[12px] text-muted">O endereço exato nunca aparece na vitrine. Você combina com a cliente depois do agendamento.</span>
        </label>
        <label className="block">
          <Label>WhatsApp para contato</Label>
          <input className={inputCls} type="tel" inputMode="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="(11) 90000-0000" />
        </label>
        <label className="block">
          <Label>Sobre você</Label>
          <textarea className={inputCls + " min-h-28 py-3"} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Há quantos anos atende, técnicas que domina, cuidados com a saúde dos fios…" />
        </label>
        <div>
          <Label>Especialidades</Label>
          <Chips multiple size="sm" options={opcoes} value={f.especialidades} onChange={(v) => setF({ ...f, especialidades: v })} />
        </div>
      </div>
    </Sheet>
  );
}

function HorarioSheet({ open, onClose, horario }: { open: boolean; onClose: () => void; horario: Horario }) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const [dias, setDias] = useState<number[]>(horario.weekdays.length ? horario.weekdays : [2, 3, 4, 5, 6]);
  const [ini, setIni] = useState(horario.ini);
  const [fim, setFim] = useState(horario.fim);
  const [pausa, setPausa] = useState(!!horario.pausa);
  const [pIni, setPIni] = useState(horario.pausa?.ini ?? "12:00");
  const [pFim, setPFim] = useState(horario.pausa?.fim ?? "13:00");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Quando você atende?"
      footer={
        <button
          type="button"
          className={btn.primary}
          disabled={saving}
          onClick={() =>
            start(async () => {
              const r = await salvarHorarioAction({ weekdays: dias, ini, fim, pausaIni: pausa ? pIni : "", pausaFim: pausa ? pFim : "" });
              if (!r.ok) return toast(r.error, true);
              toast("Horário salvo");
              onClose();
              router.refresh();
            })
          }
        >
          {saving ? "Salvando…" : "Salvar horário"}
        </button>
      }
    >
      <div className="space-y-5 pt-2">
        {!horario.uniforme && (
          <p className="rounded-2xl bg-warn-soft px-4 py-3 text-[14px] text-warn">
            Hoje alguns dias têm horários diferentes ({horario.texto}). Salvar aqui aplica o mesmo horário a todos os dias escolhidos.
          </p>
        )}
        <Chips multiple options={DIAS} value={dias} onChange={setDias} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><Label>Início</Label><input className={inputCls} type="time" value={ini} onChange={(e) => setIni(e.target.value)} /></label>
          <label className="block"><Label>Fim</Label><input className={inputCls} type="time" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
        </div>
        <label className="flex items-center gap-3 text-[15px] font-semibold">
          <input type="checkbox" className="size-5 accent-black" checked={pausa} onChange={(e) => setPausa(e.target.checked)} />
          Tenho uma pausa no meio do dia
        </label>
        {pausa && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><Label>Pausa das</Label><input className={inputCls} type="time" value={pIni} onChange={(e) => setPIni(e.target.value)} /></label>
            <label className="block"><Label>até</Label><input className={inputCls} type="time" value={pFim} onChange={(e) => setPFim(e.target.value)} /></label>
          </div>
        )}
        <p className="text-[13px] text-muted">
          Para folgas, feriados e horários diferentes em um dia específico, use <Link href="/painel/horarios" className="font-semibold text-ink underline">Horários e folgas</Link>.
        </p>
      </div>
    </Sheet>
  );
}

function Servicos({ servicos, pode }: { servicos: Servico[]; pode: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Servico | null>(null);
  const [saving, start] = useTransition();
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [min, setMin] = useState(120);

  return (
    <div className="mt-4">
      {servicos.length ? (
        <Group>
          {servicos.map((s) => (
            <button key={s.id} type="button" disabled={!pode} onClick={() => setEdit(s)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-paper disabled:hover:bg-white">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold">{s.nome}</p>
                <p className="text-[13px] text-muted">{s.duracao}{s.online ? "" : ", só pelo painel"}</p>
              </div>
              <span className="tnum text-right text-[15px] font-bold">
                {s.aPartir && <span className="block text-[11px] font-medium text-muted">a partir de</span>}
                {s.preco}
              </span>
              {pode && <ChevronRight size={16} className="text-muted" />}
            </button>
          ))}
        </Group>
      ) : (
        <p className="rounded-[22px] border border-dashed border-line-2 px-5 py-6 text-center text-[14px] text-muted">Nenhum procedimento ainda. Cadastre o primeiro abaixo.</p>
      )}

      {pode && (
        <form
          className="mt-4 rounded-[22px] border border-line bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await salvarServicoAction({ name: nome, price: Number(preco.replace(",", ".")), minutes: min });
              if (!r.ok) return toast(r.error, true);
              toast("Procedimento salvo");
              setNome("");
              setPreco("");
              router.refresh();
            });
          }}
        >
          <p className="text-[16px] font-bold">Novo procedimento</p>
          <label className="mt-3 block">
            <Label>Nome</Label>
            <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Volume russo" />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <Label>Valor (R$)</Label>
              <input className={inputCls} type="number" inputMode="decimal" min="0" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} />
            </label>
            <label className="block">
              <Label>Duração</Label>
              <select className={inputCls} value={min} onChange={(e) => setMin(Number(e.target.value))}>
                {DURACOES.map((d) => <option key={d} value={d}>{durTxt(d)}</option>)}
              </select>
            </label>
          </div>
          <button type="submit" className={btn.primary + " mt-4"} disabled={saving || !nome.trim() || preco === ""}>Salvar procedimento</button>
          <p className="mt-3 text-[13px] text-muted">
            Categorias, intervalo após o atendimento e quem faz cada procedimento ficam em <Link href="/painel/servicos" className="font-semibold text-ink underline">Todos os procedimentos</Link>.
          </p>
        </form>
      )}

      {edit && <ServicoSheet key={edit.id} s={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ServicoSheet({ s, onClose }: { s: Servico; onClose: () => void }) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const [nome, setNome] = useState(s.nome);
  const [preco, setPreco] = useState(String(s.precoCents / 100));
  const [min, setMin] = useState(s.minutos);
  const [desc, setDesc] = useState(s.descricao);
  const [aPartir, setAPartir] = useState(s.aPartir);
  const [online, setOnline] = useState(s.online);
  const duracoes = DURACOES.includes(min) ? DURACOES : [...DURACOES, min].sort((a, b) => a - b);
  return (
    <Sheet
      open
      onClose={onClose}
      title="Editar procedimento"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            className={btn.secondary.replace("w-full", "w-auto")}
            disabled={saving}
            onClick={() => {
              if (!confirm(`Apagar "${s.nome}"? Se já tiver agendamentos, ele só deixa de aparecer.`)) return;
              start(async () => {
                const r = await apagarServicoAction(s.id);
                if (!r.ok) return toast(r.error, true);
                toast("Procedimento apagado");
                onClose();
                router.refresh();
              });
            }}
          >
            Apagar
          </button>
          <button
            type="button"
            className={btn.primary}
            disabled={saving}
            onClick={() =>
              start(async () => {
                const r = await salvarServicoAction({ id: s.id, name: nome, price: Number(preco.replace(",", ".")), minutes: min, description: desc, priceFrom: aPartir, onlineVisible: online });
                if (!r.ok) return toast(r.error, true);
                toast("Procedimento salvo");
                onClose();
                router.refresh();
              })
            }
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <label className="block"><Label>Nome</Label><input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><Label>Valor (R$)</Label><input className={inputCls} type="number" inputMode="decimal" min="0" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} /></label>
          <label className="block">
            <Label>Duração</Label>
            <select className={inputCls} value={min} onChange={(e) => setMin(Number(e.target.value))}>
              {duracoes.map((d) => <option key={d} value={d}>{durTxt(d)}</option>)}
            </select>
          </label>
        </div>
        <label className="block"><Label hint="(aparece para a cliente)">Descrição</Label><textarea className={inputCls + " min-h-24 py-3"} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        <label className="flex items-center gap-3 text-[15px] font-semibold">
          <input type="checkbox" className="size-5 accent-black" checked={aPartir} onChange={(e) => setAPartir(e.target.checked)} /> Mostrar como “a partir de”
        </label>
        <label className="flex items-center gap-3 text-[15px] font-semibold">
          <input type="checkbox" className="size-5 accent-black" checked={online} onChange={(e) => setOnline(e.target.checked)} /> Clientes podem agendar pelo link
        </label>
      </div>
    </Sheet>
  );
}

function Portfolio({ fotos, pode }: { fotos: Foto[]; pode: boolean }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(0);
  const [ver, setVer] = useState<Foto | null>(null);
  const [saving, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const enviar = async (files: FileList) => {
    const lista = [...files].slice(0, 10);
    setEnviando(lista.length);
    let ok = 0;
    for (const file of lista) {
      try {
        const data = await shrinkImage(file, 1080, false, 0.8);
        const r = await addFotoAction(data);
        if (!r.ok) {
          toast(r.error, true);
          break;
        }
        ok++;
      } catch (e) {
        toast((e as Error).message, true);
      }
      setEnviando((n) => n - 1);
    }
    setEnviando(0);
    if (ok) {
      toast(ok === 1 ? "Foto adicionada" : `${ok} fotos adicionadas`);
      router.refresh();
    }
  };

  return (
    <div className="mt-4">
      <div className="grid grid-cols-3 gap-1.5">
        {pode && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={enviando > 0}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-line-2 bg-white text-[12.5px] font-semibold text-ink-2 hover:border-rimel"
          >
            <ImagePlus size={22} />
            {enviando ? `Enviando ${enviando}…` : "Adicionar fotos"}
          </button>
        )}
        {fotos.map((f) => (
          <button key={f.id} type="button" onClick={() => setVer(f)} className="overflow-hidden rounded-[14px] bg-paper-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.src} alt={f.legenda || "Trabalho do portfólio"} loading="lazy" className="aspect-square w-full object-cover" />
          </button>
        ))}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) enviar(e.target.files);
          e.target.value = "";
        }}
      />
      <p className={cx("mt-3 text-[13px] text-muted", !fotos.length && "text-center")}>
        {fotos.length ? "As fotos aparecem na sua vitrine, para as clientes verem seus trabalhos." : "Mostre seus trabalhos: antes e depois, efeitos e mappings. As fotos aparecem na vitrine."}
      </p>

      {ver && (
        <Sheet open onClose={() => setVer(null)} title="Foto do portfólio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ver.src} alt={ver.legenda || "Trabalho do portfólio"} className="w-full rounded-[18px]" />
          {pode && (
            <button
              type="button"
              className={btn.secondary + " mt-4"}
              disabled={saving}
              onClick={() => {
                if (!confirm("Apagar esta foto do portfólio?")) return;
                start(async () => {
                  const r = await apagarFotoAction(ver.id);
                  if (!r.ok) return toast(r.error, true);
                  toast("Foto apagada");
                  setVer(null);
                  router.refresh();
                });
              }}
            >
              Apagar foto
            </button>
          )}
        </Sheet>
      )}
    </div>
  );
}
