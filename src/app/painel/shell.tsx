"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft, BarChart3, CalendarDays, CalendarRange, ChevronRight, Clock4, Download, ExternalLink, House, LogOut,
  MessageCircle, ScrollText, Settings, Sparkles, Store, UserRound, Users,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Avatar, btn, cx } from "@/components/app";
import { CopyButton, Sheet, toast } from "@/components/app-client";
import { isIOS, promptInstall, useInstallable } from "@/components/pwa";

const TABS = [
  { href: "/painel", label: "Início", icon: House },
  { href: "/painel/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/painel/clientes", label: "Clientes", icon: Users },
  { href: "/painel/negocio", label: "Negócio", icon: BarChart3 },
  { href: "/painel/vitrine", label: "Vitrine", icon: Store },
] as const;

/** Títulos das telas que não são abas (o primeiro prefixo que bater). */
const TITLES: [string, string, string][] = [
  ["/painel/agenda/semana", "Agenda da semana", "/painel/agenda"],
  ["/painel/agendamentos", "Agendamento", "/painel/agenda"],
  ["/painel/clientes/nova", "Nova cliente", "/painel/clientes"],
  ["/painel/clientes/", "Cliente", "/painel/clientes"],
  ["/painel/servicos", "Procedimentos", "/painel/vitrine"],
  ["/painel/horarios", "Horários e folgas", "/painel/vitrine"],
  ["/painel/equipe", "Equipe", "/painel/configuracoes"],
  ["/painel/configuracoes/empresa", "Dados do negócio", "/painel/configuracoes"],
  ["/painel/configuracoes/agendamento", "Regras de agendamento", "/painel/configuracoes"],
  ["/painel/configuracoes", "Configurações", "/painel"],
  ["/painel/notificacoes", "Mensagens enviadas", "/painel/configuracoes"],
  ["/painel/auditoria", "Histórico de ações", "/painel/configuracoes"],
];

function tabActive(path: string, href: string) {
  if (href === "/painel") return path === "/painel";
  return path === href || (path.startsWith(href + "/") && !path.startsWith("/painel/agenda/semana"));
}

export function PanelShell({ pending, orgName, userName, roleLabel, photo, publicUrl, perms, logout, children }: {
  pending: number;
  orgName: string;
  userName: string;
  roleLabel: string;
  photo: string | null;
  publicUrl: string;
  perms: { team: boolean; audit: boolean; settings: boolean; services: boolean; hours: boolean; reports: boolean };
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [mais, setMais] = useState(false);
  const installable = useInstallable();
  const isTab = TABS.some((t) => t.href === path);
  const sub = isTab ? null : TITLES.find(([p]) => path.startsWith(p));

  const links: { href: string; label: string; icon: typeof House; show: boolean }[] = [
    { href: "/painel/agenda/semana", label: "Agenda da semana e bloqueios", icon: CalendarRange, show: true },
    { href: "/painel/horarios", label: "Horários e folgas", icon: Clock4, show: perms.hours },
    { href: "/painel/servicos", label: "Todos os procedimentos", icon: Sparkles, show: perms.services },
    { href: "/painel/configuracoes", label: "Configurações", icon: Settings, show: true },
    { href: "/painel/equipe", label: "Equipe", icon: UserRound, show: perms.team },
    { href: "/painel/notificacoes", label: "Mensagens enviadas", icon: MessageCircle, show: true },
    { href: "/painel/auditoria", label: "Histórico de ações", icon: ScrollText, show: perms.audit },
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
        <div className="mx-auto flex max-w-[680px] items-center gap-3 px-4 pt-[calc(10px+env(safe-area-inset-top,0px))] pb-2.5">
          {sub ? (
            <>
              <button
                type="button"
                className={btn.icon}
                aria-label="Voltar"
                onClick={() => (window.history.length > 1 ? router.back() : router.push(sub[2]))}
              >
                <ArrowLeft size={18} />
              </button>
              <span className="min-w-0 flex-1 truncate text-[17px] font-bold">{sub[1]}</span>
            </>
          ) : (
            <Link href="/painel" className="min-w-0 flex-1" aria-label="Início">
              <Wordmark size="sm" />
            </Link>
          )}
          <button type="button" onClick={() => setMais(true)} className="rounded-full" aria-label="Abrir menu da conta">
            <Avatar name={orgName} photo={photo} size={40} className="ring-2 ring-white" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[680px] px-4 pt-5 pb-[calc(110px+env(safe-area-inset-bottom,0px))]">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur" aria-label="Navegação principal">
        <div className="mx-auto flex max-w-[680px] pb-[env(safe-area-inset-bottom,0px)]">
          {TABS.map((t) => {
            const on = tabActive(path, t.href);
            const badge = (t.href === "/painel" || t.href === "/painel/agenda") && pending > 0 ? pending : 0;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={cx("relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold", on ? "text-rimel" : "text-muted")}
              >
                <span className={cx("flex h-8 w-14 items-center justify-center rounded-full transition-colors", on && "bg-gel")}>
                  <t.icon size={21} strokeWidth={on ? 2.2 : 1.8} />
                </span>
                {t.label}
                {badge > 0 && (
                  <span className="absolute top-1.5 left-[calc(50%+8px)] min-w-[18px] rounded-full bg-framboesa px-1 text-center text-[11px] leading-[18px] text-white" aria-label={`${badge} pedidos novos`}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <Sheet open={mais} onClose={() => setMais(false)} title="Sua conta">
        <div className="flex items-center gap-3">
          <Avatar name={orgName} photo={photo} size={52} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-bold">{orgName}</p>
            <p className="truncate text-[13px] text-muted">{userName}, {roleLabel.toLowerCase()}</p>
          </div>
        </div>

        <div className="mt-5 rounded-[22px] bg-gel p-4">
          <p className="text-[14px] font-bold text-gel-ink">Seu link de agendamento</p>
          <p className="mt-1 break-all text-[13px] text-gel-ink/80">{publicUrl.replace(/^https?:\/\//, "")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton text={publicUrl} />
            <a className={btn.mini} href={`https://wa.me/?text=${encodeURIComponent(`Agende seu horário comigo: ${publicUrl}`)}`} target="_blank" rel="noopener">
              <MessageCircle size={15} /> WhatsApp
            </a>
            <a className={btn.mini} href={publicUrl} target="_blank" rel="noopener">
              <ExternalLink size={15} /> Abrir
            </a>
          </div>
        </div>

        <div className="mt-4 divide-y divide-line overflow-hidden rounded-[22px] border border-line">
          {links.filter((l) => l.show).map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setMais(false)} className="flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium hover:bg-paper">
              <l.icon size={19} className="text-ink-2" />
              <span className="flex-1">{l.label}</span>
              <ChevronRight size={17} className="text-muted" />
            </Link>
          ))}
          {(installable || isIOSSafari()) && (
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium hover:bg-paper"
              onClick={async () => {
                if (installable) {
                  await promptInstall();
                } else {
                  toast("No Safari: toque em Compartilhar e depois em Adicionar à Tela de Início.");
                }
              }}
            >
              <Download size={19} className="text-ink-2" />
              <span className="flex-1">Instalar o app no celular</span>
            </button>
          )}
        </div>

        <form action={logout} className="mt-4">
          <button className={btn.secondary} type="submit">
            <LogOut size={17} /> Sair da conta
          </button>
        </form>
      </Sheet>
    </div>
  );
}

function isIOSSafari() {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  return isIOS() && !standalone;
}
