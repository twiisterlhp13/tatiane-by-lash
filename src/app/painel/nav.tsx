"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3, CalendarDays, Check, Clock4, ExternalLink, LogOut, Menu, Settings, Share2, Sparkles, TrendingUp, UserRound, X,
} from "lucide-react";
import { cx } from "@/components/ui";

const ICONS = {
  calendar: CalendarDays, free: Clock4, share: Share2, dashboard: BarChart3, money: TrendingUp,
  users: UserRound, sparkles: Sparkles, settings: Settings,
};
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

/** Títulos da barra superior por rota (o primeiro prefixo que bater). */
const TITLES: [string, string][] = [
  ["/painel/agenda", "Agenda"],
  ["/painel/horarios-livres", "Horários livres"],
  ["/painel/faturamento", "Faturamento"],
  ["/painel/clientes", "Clientes"],
  ["/painel/servicos", "Serviços"],
  ["/painel/equipe", "Profissionais"],
  ["/painel/horarios", "Horário de atendimento"],
  ["/painel/configuracoes/empresa", "Perfil da empresa"],
  ["/painel/configuracoes/agendamento", "Agenda do cliente"],
  ["/painel/notificacoes", "Mensagens"],
  ["/painel/auditoria", "Auditoria"],
  ["/painel/configuracoes", "Configurações"],
  ["/painel/agendamentos", "Agendamento"],
  ["/painel", "Dashboard"],
];

function isActive(path: string, href: string) {
  if (href.startsWith("#")) return false;
  return href === "/painel" ? path === "/painel" : path.startsWith(href);
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function PanelShell({ items, orgName, userName, roleLabel, publicUrl, logout, children }: {
  items: NavItem[];
  orgName: string;
  userName: string;
  roleLabel: string;
  publicUrl: string;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const path = usePathname();
  // o menu fica aberto só na página em que foi aberto (fecha sozinho ao navegar)
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);

  const title = TITLES.find(([p]) => path.startsWith(p))?.[1] ?? "Painel";

  async function shareLink() {
    try {
      if (navigator.share) await navigator.share({ url: publicUrl, title: `Agende com ${orgName}` });
      else {
        await navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  }

  const menu = (
    <div className="flex h-full flex-col bg-[#3a1828] text-white">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/95 font-display text-lg text-berry">{initials(orgName)}</span>
        <span className="min-w-0 pr-8">
          <span className="block truncate font-display text-lg leading-tight">{orgName}</span>
          <span className="block truncate text-xs text-white/60">{userName} · {roleLabel}</span>
        </span>
      </div>
      <nav className="scroll-thin flex-1 space-y-0.5 overflow-y-auto pr-3">
        {items.map((it) => {
          const Icon = ICONS[it.icon];
          const active = isActive(path, it.href);
          const inner = (
            <>
              <Icon size={20} strokeWidth={1.8} className={active ? "text-white" : "text-white/70"} />
              <span className="flex-1">{it.label}</span>
              {it.href === "#meu-link" && copied && <span className="flex items-center gap-1 text-xs"><Check size={14} /> copiado</span>}
              {!!it.badge && it.badge > 0 && (
                <span className="flex min-w-6 items-center justify-center rounded-full bg-[#e0475b] px-1.5 py-0.5 text-[11px] font-semibold">{it.badge}</span>
              )}
            </>
          );
          const cls = cx(
            "flex w-full items-center gap-4 rounded-r-full py-3 pl-6 pr-4 text-left text-[15px] transition-colors",
            active ? "bg-white/15 font-medium" : "text-white/85 hover:bg-white/5",
          );
          return it.href === "#meu-link" ? (
            <button key={it.href} className={cls} onClick={shareLink}>{inner}</button>
          ) : (
            <Link key={it.href} href={it.href} className={cls}>{inner}</Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <a href={publicUrl} target="_blank" className="flex items-center gap-4 rounded-full py-2.5 pl-3 text-sm text-white/70 hover:bg-white/5">
          <ExternalLink size={18} /> Ver minha página
        </a>
        <form action={logout}>
          <button className="flex w-full items-center gap-4 rounded-full py-2.5 pl-3 text-sm text-white/70 hover:bg-white/5">
            <LogOut size={18} /> Sair
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden w-72 shrink-0 lg:sticky lg:top-0 lg:block lg:h-dvh">{menu}</aside>

      <dialog ref={ref} onClose={() => setOpenAt(null)} onClick={(e) => { if (e.target === ref.current) setOpenAt(null); }}
        className="m-0 h-dvh max-h-none w-[300px] max-w-[85vw] bg-transparent p-0 lg:hidden">
        {open && (
          <div className="relative h-full">
            {menu}
            <button aria-label="Fechar menu" onClick={() => setOpenAt(null)} className="absolute right-3 top-3 rounded-full p-2 text-white/70 hover:bg-white/10"><X size={20} /></button>
          </div>
        )}
      </dialog>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 bg-gradient-to-r from-berry-2 to-berry text-white shadow-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-2 sm:px-4 lg:px-8">
            <button aria-label="Abrir menu" onClick={() => setOpenAt(path)} className="rounded-full p-2.5 hover:bg-white/10 lg:hidden">
              <Menu size={22} />
            </button>
            <h1 className="flex-1 truncate text-center text-[17px] font-medium tracking-wide lg:text-left lg:text-base lg:font-normal lg:text-white/80">{title}</h1>
            <div className="w-11 lg:hidden" />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-3 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>
      </div>
    </div>
  );
}

/** Botão + flutuante, no canto inferior direito. */
export function Fab({ onClick, href, label = "Novo" }: { onClick?: () => void; href?: string; label?: string }) {
  const cls =
    "fixed bottom-[max(20px,env(safe-area-inset-bottom))] right-5 z-30 flex size-14 items-center justify-center rounded-full bg-berry text-white shadow-[0_6px_20px_rgb(111_47_73/0.45)] transition-transform active:scale-95 lg:right-10";
  const icon = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
  return href ? (
    <Link href={href} aria-label={label} className={cls}>{icon}</Link>
  ) : (
    <button aria-label={label} onClick={onClick} className={cls}>{icon}</button>
  );
}
