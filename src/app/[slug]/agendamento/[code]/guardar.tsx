"use client";

import { useEffect } from "react";

/** Quem abre o link do agendamento passa a vê-lo em "Meus horários" neste aparelho. */
export function GuardarNoAparelho({ slug, code, token }: { slug: string; code: string; token: string }) {
  useEffect(() => {
    try {
      const k = `tbl_meus_${slug}`;
      const l: { code: string; token: string }[] = JSON.parse(localStorage.getItem(k) || "[]");
      const resto = l.filter((x) => x.code !== code);
      localStorage.setItem(k, JSON.stringify([{ code, token }, ...resto].slice(0, 40)));
    } catch {}
  }, [slug, code, token]);
  return null;
}
