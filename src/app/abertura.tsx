"use client";

import Link from "next/link";
import { useState } from "react";
import { BarChart3, CalendarCheck, ChevronRight, MapPin, Smartphone, Sparkles } from "lucide-react";
import { LashMark, Wordmark } from "@/components/brand";
import { Avatar, btn, cx } from "@/components/app";
import { isIOS, isStandalone, promptInstall, useInstallable } from "@/components/pwa";
import { useStored, writeStored } from "@/components/app-client";

const TUTORIAL = [
  {
    icon: CalendarCheck,
    titulo: "Seu horário em poucos toques",
    texto: "Escolha o procedimento, veja os horários livres e peça o seu horário sem precisar trocar mensagens.",
  },
  {
    icon: Sparkles,
    titulo: "Tudo acompanhado pelo app",
    texto: "Você recebe a confirmação e acompanha, remarca ou cancela em Meus horários.",
  },
  {
    icon: BarChart3,
    titulo: "Para a lash designer, estrutura",
    texto: "Agenda, clientes, financeiro, estoque e uma IA que entende o negócio, tudo no celular.",
  },
];

function concluirAbertura() {
  writeStored("tbl_intro", "1");
  document.documentElement.classList.remove("primeira-visita");
}

export function Abertura({ slug, nome, foto, area }: { slug: string | null; nome: string; foto: string | null; area: string }) {
  // null = decidindo; -1 = escolha; 0..4 = abertura
  const intro = useStored("tbl_intro");
  const [escolhido, setPasso] = useState<number | null>(null);
  const passo = escolhido ?? (intro === null ? null : intro === "1" ? -1 : 0);
  const installable = useInstallable();

  const fim = () => {
    concluirAbertura();
    setPasso(-1);
    window.scrollTo(0, 0);
  };
  const proximo = () => {
    const n = (passo ?? 0) + 1;
    if (n >= 4 && isStandalone()) return fim();
    if (n > 4) return fim();
    setPasso(n);
    window.scrollTo(0, 0);
  };

  if (passo === 0) {
    return (
      <section className="flex min-h-dvh flex-col bg-gel px-6 pt-[calc(28px+env(safe-area-inset-top,0px))] pb-[calc(28px+env(safe-area-inset-bottom,0px))] text-rimel">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <LashMark size={220} animated strokeWidth={1.9} />
            <p className="surge mt-8 text-[13px] font-semibold text-gel-ink" style={{ animationDelay: "1.9s" }}>
              Bem-vinda à TATIANE By Lash
            </p>
            <h1 className="surge mt-3 text-[40px] leading-[1.05] font-extrabold tracking-[-0.035em]" style={{ animationDelay: "2.1s" }}>
              Seu olhar,<br />fio a fio.
            </h1>
          </div>
          <div className="surge space-y-2" style={{ animationDelay: "2.5s" }}>
            <button type="button" className={btn.primary} onClick={proximo}>Começar</button>
            <button type="button" className={btn.text + " w-full"} onClick={fim}>Pular</button>
          </div>
        </div>
      </section>
    );
  }

  if (passo !== null && passo >= 1 && passo <= 4) {
    const pts = (
      <div className="mb-6 flex justify-center gap-2" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <i key={i} className={cx("h-2 rounded-full transition-all", i === passo ? "w-6 bg-rimel" : "w-2 bg-line-2")} />
        ))}
      </div>
    );
    if (passo <= 3) {
      const t = TUTORIAL[passo - 1];
      return (
        <section className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[calc(18px+env(safe-area-inset-top,0px))] pb-[calc(28px+env(safe-area-inset-bottom,0px))]">
          <button type="button" onClick={fim} className="self-end px-1 py-3 text-[14px] font-semibold text-muted">Pular</button>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-8 flex size-[120px] items-center justify-center rounded-full bg-gel">
              <t.icon size={52} strokeWidth={1.5} />
            </div>
            <h2 className="text-[28px] leading-tight font-bold">{t.titulo}</h2>
            <p className="mt-3 max-w-[340px] text-[16px] text-ink-2">{t.texto}</p>
          </div>
          {pts}
          <button type="button" className={btn.primary} onClick={proximo}>Continuar</button>
        </section>
      );
    }
    const ios = isIOS();
    const passos = ios
      ? ["Toque em Compartilhar na barra do Safari", "Escolha “Adicionar à Tela de Início”", "Toque em “Adicionar”"]
      : ["Toque no menu ⋮ do navegador", "Escolha “Adicionar à tela inicial” ou “Instalar app”", "Confirme"];
    return (
      <section className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[calc(18px+env(safe-area-inset-top,0px))] pb-[calc(28px+env(safe-area-inset-bottom,0px))]">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-8 flex size-[120px] items-center justify-center rounded-full bg-gel">
            <Smartphone size={52} strokeWidth={1.5} />
          </div>
          <h2 className="text-[28px] leading-tight font-bold">Leve o app na tela inicial</h2>
          <p className="mt-3 max-w-[340px] text-[16px] text-ink-2">Ele abre como um aplicativo, em tela cheia, sem precisar procurar o link.</p>
          {!installable && (
            <ol className="mt-6 grid w-full max-w-[340px] gap-2 text-left">
              {passos.map((p, i) => (
                <li key={p} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-[14px]">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rimel text-[13px] font-bold text-white">{i + 1}</span>
                  {p}
                </li>
              ))}
            </ol>
          )}
        </div>
        {pts}
        {installable ? (
          <div className="space-y-2">
            <button type="button" className={btn.primary} onClick={async () => { await promptInstall(); fim(); }}>Adicionar à tela inicial</button>
            <button type="button" className={btn.text + " w-full"} onClick={fim}>Agora não</button>
          </div>
        ) : (
          <button type="button" className={btn.primary} onClick={fim}>Entendi, vamos lá</button>
        )}
      </section>
    );
  }

  return (
    <main className="landing mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[calc(22px+env(safe-area-inset-top,0px))] pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
      <Wordmark size="md" />
      <div className="flex flex-1 flex-col justify-center py-10">
        <h1 className="text-[38px] leading-[1.06] font-extrabold tracking-[-0.035em]">Cílios e sobrancelhas com hora marcada.</h1>
        {(foto || area) && (
          <div className="mt-5 flex items-center gap-3">
            <Avatar name={nome} photo={foto} size={44} />
            <div className="min-w-0 text-[14px]">
              <p className="truncate font-bold">{nome}</p>
              {area && <p className="flex items-center gap-1 truncate text-muted"><MapPin size={13} /> {area}</p>}
            </div>
          </div>
        )}
        <p className="mt-6 text-[16px] text-ink-2">Como você quer usar o app?</p>
        <div className="mt-4 grid gap-3">
          {slug && (
            <Link href={`/${slug}`} className="group flex items-center gap-4 rounded-[24px] bg-rimel px-5 py-5 text-white">
              <span className="flex-1">
                <span className="block text-[19px] font-bold">Quero agendar meu horário</span>
                <span className="mt-1 block text-[14px] text-white/75">Veja procedimentos, valores e horários livres</span>
              </span>
              <ChevronRight size={22} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          <Link href="/cadastro" className="group flex items-center gap-4 rounded-[24px] border-[1.5px] border-rimel bg-white px-5 py-5">
            <span className="flex-1">
              <span className="block text-[19px] font-bold">Sou lash designer</span>
              <span className="mt-1 block text-[14px] text-muted">Agenda, clientes, financeiro e uma IA que entende o seu negócio</span>
            </span>
            <ChevronRight size={22} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <Link href="/entrar" className={btn.text + " mt-4 self-center"}>Já tenho conta: entrar</Link>
      </div>
      <footer className="flex justify-center gap-4 text-[12px] text-muted">
        <Link href="/termos" className="hover:underline">Termos de uso</Link>
        <Link href="/privacidade" className="hover:underline">Privacidade</Link>
      </footer>
    </main>
  );
}
