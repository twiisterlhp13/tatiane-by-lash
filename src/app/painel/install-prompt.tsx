"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Convite para instalar o painel como app no Android (PWA). */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    let dismissed = false;
    try { dismissed = localStorage.getItem("tbl-install-dismissed") === "1"; } catch {}
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIP);
      if (!dismissed) setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!evt || hidden) return null;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-berry/20 bg-berry-soft px-4 py-3 text-sm">
      <Download size={20} className="shrink-0 text-berry" />
      <p className="flex-1 text-ink-2">Instale a agenda no seu celular para abrir como um app.</p>
      <button
        className="rounded-full bg-berry px-4 py-2 font-medium text-white"
        onClick={async () => { await evt.prompt(); setHidden(true); }}
      >
        Instalar
      </button>
      <button aria-label="Dispensar" className="p-1 text-muted" onClick={() => { setHidden(true); try { localStorage.setItem("tbl-install-dismissed", "1"); } catch {} }}>
        <X size={18} />
      </button>
    </div>
  );
}
