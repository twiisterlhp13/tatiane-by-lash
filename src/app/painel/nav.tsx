"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, Clock, Home, Menu, Settings, Shield, Sparkles, UserRound, Users, X } from "lucide-react";
import { cx } from "@/components/ui";

const ICONS = { home: Home, calendar: CalendarDays, users: UserRound, sparkles: Sparkles, team: Users, clock: Clock, settings: Settings, bell: Bell, shield: Shield };
type Item = { href: string; label: string; icon: string };

function isActive(path: string, href: string) {
  return href === "/painel" ? path === "/painel" : path.startsWith(href);
}

export function PanelNav({ items, variant }: { items: Item[]; variant: "side" | "bottom" | "menu" }) {
  const path = usePathname();
  // o menu fica aberto só na página em que foi aberto (fecha sozinho ao navegar)
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (v: boolean) => setOpenAt(v ? path : null);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);

  if (variant === "side") {
    return (
      <nav className="mt-8 space-y-1">
        {items.map((it) => {
          const Icon = ICONS[it.icon as keyof typeof ICONS];
          const active = isActive(path, it.href);
          return (
            <Link key={it.href} href={it.href} className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]", active ? "bg-berry-soft text-berry font-medium" : "text-ink-2 hover:bg-paper-2")}>
              <Icon size={18} strokeWidth={1.8} /> {it.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  if (variant === "bottom") {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {items.map((it) => {
          const Icon = ICONS[it.icon as keyof typeof ICONS];
          const active = isActive(path, it.href);
          return (
            <Link key={it.href} href={it.href} className={cx("flex flex-col items-center gap-0.5 py-2.5 text-[11px]", active ? "text-berry" : "text-muted")}>
              <Icon size={22} strokeWidth={active ? 2.2 : 1.7} />
              {it.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      <button aria-label="Abrir menu" onClick={() => setOpen(true)} className="rounded-full p-2 text-ink-2 hover:bg-paper-2">
        <Menu size={22} />
      </button>
      <dialog ref={ref} onClose={() => setOpen(false)} className="m-0 ml-auto h-dvh max-h-none w-72 max-w-[85vw] bg-white p-0 shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="font-display text-lg">Menu</span>
          <button aria-label="Fechar" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-paper-2"><X size={20} /></button>
        </div>
        <nav className="space-y-1 p-3">
          {items.map((it) => {
            const Icon = ICONS[it.icon as keyof typeof ICONS];
            const active = isActive(path, it.href);
            return (
              <Link key={it.href} href={it.href} className={cx("flex items-center gap-3 rounded-xl px-3 py-3", active ? "bg-berry-soft text-berry font-medium" : "text-ink-2")}>
                <Icon size={19} strokeWidth={1.8} /> {it.label}
              </Link>
            );
          })}
        </nav>
      </dialog>
    </>
  );
}
