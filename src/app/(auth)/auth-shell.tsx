import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <Link href="/" className="mb-8 text-center">
        <span className="font-display text-2xl tracking-wide text-berry">Tatiane</span>
        <span className="ml-1.5 text-[11px] uppercase tracking-[0.3em] text-muted">by lash</span>
      </Link>
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <h1 className="font-display text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
    </main>
  );
}
