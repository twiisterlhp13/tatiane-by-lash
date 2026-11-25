import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/" className="text-sm text-muted hover:text-ink">← Início</Link>
      <h1 className="mt-6 font-display text-4xl">{title}</h1>
      <p className="mt-1 text-sm text-muted">Última atualização: {updated}</p>
      <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-ink-2 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
