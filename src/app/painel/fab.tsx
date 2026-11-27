"use client";

import Link from "next/link";

/** Botão flutuante preto (fica acima da navegação inferior). */
export function Fab({ onClick, href, label = "Novo" }: { onClick?: () => void; href?: string; label?: string }) {
  const cls =
    "fixed right-5 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-20 flex size-[60px] items-center justify-center rounded-full bg-rimel text-white shadow-[0_10px_30px_rgb(0_0_0/0.25)] transition-transform active:scale-95 lg:right-[calc(50%-320px)]";
  const icon = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
  return href ? (
    <Link href={href} aria-label={label} className={cls}>{icon}</Link>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={cls}>{icon}</button>
  );
}
