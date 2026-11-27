import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { btn } from "@/components/app";

export function AuthShell({ title, subtitle, children, footer, back = "/" }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; back?: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-10">
      <div className="flex items-center gap-3 py-2">
        <Link href={back} className={btn.icon} aria-label="Voltar"><ArrowLeft size={18} /></Link>
        <Link href="/" className="ml-auto" aria-label="Início"><Wordmark size="sm" /></Link>
      </div>
      <h1 className="mt-8 text-[30px] leading-tight font-bold">{title}</h1>
      {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
      <div className="mt-7">{children}</div>
      {footer && <div className="mt-8 text-center text-[14px] text-muted">{footer}</div>}
    </main>
  );
}
