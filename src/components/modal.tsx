"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  // fechar por código (open=false) não deve disparar onClose: senão um modal que abre outro em seguida é anulado
  const programmatic = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) {
      programmatic.current = true;
      d.close();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (programmatic.current) { programmatic.current = false; return; }
        onClose();
      }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={`m-auto w-[calc(100%-24px)] ${wide ? "max-w-2xl" : "max-w-lg"} rounded-[22px] bg-white p-0 text-ink shadow-2xl`}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-24px)] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">{title}</h2>
            <button type="button" aria-label="Fechar" onClick={onClose} className="rounded-full p-2 text-muted hover:bg-paper-2"><X size={20} /></button>
          </div>
          <div className="scroll-thin overflow-y-auto px-5 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
