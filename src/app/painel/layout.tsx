import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/permissions";
import { logoutAction } from "../(auth)/actions";
import { PanelNav } from "./nav";
import { InstallPrompt } from "./install-prompt";

export const metadata = { title: "Painel", manifest: "/manifest.webmanifest" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const items = [
    { href: "/painel", label: "Início", icon: "home" },
    { href: "/painel/agenda", label: "Agenda", icon: "calendar" },
    { href: "/painel/clientes", label: "Clientes", icon: "users" },
    ...(ctx.can("services.manage") ? [{ href: "/painel/servicos", label: "Serviços", icon: "sparkles" }] : []),
    ...(ctx.can("team.manage") ? [{ href: "/painel/equipe", label: "Equipe", icon: "team" }] : []),
    { href: "/painel/horarios", label: "Horários", icon: "clock" },
    ...(ctx.can("settings.manage") ? [{ href: "/painel/configuracoes", label: "Configurações", icon: "settings" }] : []),
    ...(ctx.can("settings.manage") ? [{ href: "/painel/notificacoes", label: "Notificações", icon: "bell" }] : []),
    ...(ctx.can("audit.view") ? [{ href: "/painel/auditoria", label: "Auditoria", icon: "shield" }] : []),
  ];
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-white/70 px-4 py-6 lg:flex lg:sticky lg:top-0 lg:h-dvh">
        <Link href="/painel" className="px-3">
          <span className="block font-display text-xl text-berry leading-tight">{ctx.org.name}</span>
          <span className="text-xs text-muted">Painel de gestão</span>
        </Link>
        <PanelNav items={items} variant="side" />
        <div className="mt-auto space-y-3 border-t border-line px-3 pt-4 text-sm">
          <div>
            <p className="font-medium">{ctx.user.name}</p>
            <p className="text-xs text-muted">{ROLE_LABEL[ctx.role]}</p>
          </div>
          <a href={`/${ctx.org.slug}`} target="_blank" className="block text-berry hover:underline">Ver minha página pública ↗</a>
          <form action={logoutAction}>
            <button className="text-muted hover:text-ink">Sair</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/painel" className="font-display text-lg text-berry">{ctx.org.name}</Link>
          <div className="flex items-center gap-3 text-sm">
            <PanelNav items={items} variant="menu" />
            <form action={logoutAction}><button className="text-muted">Sair</button></form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <InstallPrompt />
          {children}
        </main>
        <PanelNav items={items.slice(0, 4)} variant="bottom" />
      </div>
    </div>
  );
}
