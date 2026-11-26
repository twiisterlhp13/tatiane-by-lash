"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronDown, MessageCircle, Phone, UserRound } from "lucide-react";
import { cx } from "@/components/ui";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

export function ClientCard(c: {
  id: string; name: string; phone: string; rawPhone: string; email: string; birth: string; notes: string;
  visits: number; spentCents: number; last: string; next: string;
}) {
  const [open, setOpen] = useState(false);
  const wa = c.rawPhone ? `https://wa.me/${c.rawPhone.replace(/\D/g, "").replace(/^(?!55)/, "55")}` : "";
  return (
    <div className="rounded-2xl border border-line bg-white shadow-[var(--shadow-soft)]">
      <Link href={`/painel/clientes/${c.id}`} className="flex items-center gap-3 px-4 pb-2 pt-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-berry text-sm font-semibold text-white">{initials(c.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px]">{c.name}</span>
          <span className="flex flex-wrap items-center justify-between gap-x-3 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5 tnum"><Phone size={13} className="text-ok" /> {c.phone || "sem telefone"}</span>
            {c.birth && <span className="tnum">Nascimento {c.birth}</span>}
          </span>
        </span>
      </Link>
      <div className="flex justify-end px-3 pb-2">
        <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted hover:bg-paper-2" aria-expanded={open}>
          Exibir detalhes <ChevronDown size={14} className={cx("transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div className="border-t border-line px-4 py-3 text-sm">
          <dl className="grid grid-cols-2 gap-y-1.5">
            <dt className="text-muted">Atendimentos</dt><dd className="text-right tnum">{c.visits}</dd>
            <dt className="text-muted">Total gasto</dt><dd className="text-right tnum">{(c.spentCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd>
            <dt className="text-muted">Último atendimento</dt><dd className="text-right tnum">{c.last || "—"}</dd>
            <dt className="text-muted">Próximo horário</dt><dd className="text-right tnum">{c.next || "—"}</dd>
            {c.email && (<><dt className="text-muted">E-mail</dt><dd className="truncate text-right">{c.email}</dd></>)}
          </dl>
          {c.notes && <p className="mt-2 rounded-lg bg-paper-2 px-3 py-2 text-ink-2">{c.notes}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-3 py-1.5 text-xs font-medium text-ok"><MessageCircle size={14} /> WhatsApp</a>
            )}
            <Link href="/painel/agenda?novo=1" className="inline-flex items-center gap-1.5 rounded-full bg-berry-soft px-3 py-1.5 text-xs font-medium text-berry"><CalendarPlus size={14} /> Agendar</Link>
            <Link href={`/painel/clientes/${c.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-3 py-1.5 text-xs font-medium text-ink-2"><UserRound size={14} /> Ficha completa</Link>
          </div>
        </div>
      )}
    </div>
  );
}
