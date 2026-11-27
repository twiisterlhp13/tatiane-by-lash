"use client";

import { useEffect, useState } from "react";

export type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

declare global {
  interface Window {
    __bip?: BIP | null;
  }
}

/** Registra o service worker e guarda o convite de instalação do Android para usar depois. */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__bip = e as BIP;
      window.dispatchEvent(new Event("tbl:installable"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return null;
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** true quando o navegador oferece instalar com um toque (Android/Chrome). */
export function useInstallable() {
  const [can, setCan] = useState(false);
  useEffect(() => {
    const check = () => setCan(!!window.__bip && !isStandalone());
    check();
    window.addEventListener("tbl:installable", check);
    return () => window.removeEventListener("tbl:installable", check);
  }, []);
  return can;
}

export async function promptInstall() {
  const p = window.__bip;
  if (!p) return false;
  window.__bip = null;
  await p.prompt();
  try {
    const c = await p.userChoice;
    return c.outcome === "accepted";
  } catch {
    return false;
  }
}
