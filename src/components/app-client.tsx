"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Check, Copy, X } from "lucide-react";
import { btn, cx } from "./app";

/** Aviso rápido no rodapé (some sozinho). */
export function toast(text: string, erro = false) {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".toast").forEach((n) => n.remove());
  const d = document.createElement("div");
  d.className = "toast" + (erro ? " erro" : "");
  d.setAttribute("role", "status");
  d.textContent = text;
  document.body.append(d);
  setTimeout(() => d.remove(), 3200);
}

/** Folha que sobe do rodapé, para criar e editar sem sair da tela. */
export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-label={title}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2">
            <h2 className="text-[22px] font-bold leading-tight">{title}</h2>
            <button type="button" onClick={onClose} className={btn.icon} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          <div className="scroll-thin flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {footer && <div className="border-t border-line px-5 pt-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))]">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Seleção por fichas (uma ou várias). */
export function Chips<T extends string | number>({ options, value, onChange, multiple = false, className, size = "md" }: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  multiple?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cx("flex flex-wrap gap-2", className)} role="group">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => {
              if (multiple) onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value]);
              else onChange([o.value]);
            }}
            className={cx(
              "rounded-full border font-semibold transition-colors",
              size === "sm" ? "min-h-9 px-3.5 text-[13px]" : "min-h-11 px-4 text-[14px]",
              on ? "border-rimel bg-rimel text-white" : "border-line-2 bg-white text-ink hover:border-rimel",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Abas internas (ex.: Financeiro | Estoque). */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mt-4 flex rounded-full bg-paper-2 p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "min-h-10 flex-1 rounded-full text-[14px] font-semibold transition-colors",
            value === o.value ? "bg-white text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CopyButton({ text, label = "Copiar link", className }: { text: string; label?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={className ?? btn.mini}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1800);
        } catch {
          toast("Não consegui copiar. Segure o texto para copiar.", true);
        }
      }}
    >
      {ok ? <Check size={15} /> : <Copy size={15} />}
      {ok ? "Copiado" : label}
    </button>
  );
}

/** Lê um arquivo de imagem e devolve um JPEG reduzido (data URL), recortado ao centro quando `square`. */
export function shrinkImage(file: File, max: number, square: boolean, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (square) {
        const s = Math.min(img.width, img.height);
        sx = (img.width - s) / 2;
        sy = (img.height - s) * 0.3;
        sw = sh = s;
      }
      const scale = Math.min(1, max / Math.max(sw, sh));
      const c = document.createElement("canvas");
      c.width = Math.round(sw * scale);
      c.height = Math.round(sh * scale);
      c.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não consegui abrir essa imagem.")); };
    img.src = url;
  });
}

/* ------------------------------------------------------------------ */
/* Valores guardados no aparelho (localStorage) sem efeitos colaterais  */
/* ------------------------------------------------------------------ */

const EVT = "tbl-storage";
function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
}

/** Lê uma chave do localStorage de forma reativa. No servidor devolve `null`. */
export function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        return localStorage.getItem(key) ?? "";
      } catch {
        return "";
      }
    },
    () => null,
  );
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new Event(EVT));
}

const noop = () => () => {};
/** true depois que o app abriu no navegador (false na renderização do servidor). */
export function useIsClient() {
  return useSyncExternalStore(noop, () => true, () => false);
}
