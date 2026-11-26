"use client";

import { useState, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import { cx } from "@/components/ui";

export function DashSection({ title, aside, hint, children }: { title: string; aside?: string; hint?: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-2xl border border-line bg-white shadow-[var(--shadow-soft)]">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-5 py-4 text-left">
        <h2 className="flex-1 text-[17px] font-semibold">{title}</h2>
        {aside && <span className="rounded-full bg-berry-soft px-2.5 py-0.5 text-xs font-semibold text-berry">{aside}</span>}
        <ChevronUp size={20} className={cx("text-muted transition-transform", !open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-5 pb-4">
          {hint && <p className="-mt-2 mb-2 text-xs text-muted">{hint}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v >= 1000 ? 0 : 2 });

/** Linha de faturamento por mês, com área suave e valor ao tocar. */
export function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const [sel, setSel] = useState(data.length - 1);
  const W = 640, H = 200, P = { l: 8, r: 8, t: 30, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  // curva suave (Catmull-Rom → Bézier)
  const path = pts.reduce((acc, [px, py], i, arr) => {
    if (i === 0) return `M${px},${py}`;
    const [x0, y0] = arr[i - 2] ?? arr[i - 1];
    const [x1, y1] = arr[i - 1];
    const [x3, y3] = arr[i + 1] ?? [px, py];
    const c1 = [x1 + (px - x0) / 6, y1 + (py - y0) / 6];
    const c2 = [px - (x3 - x1) / 6, py - (y3 - y1) / 6];
    return `${acc} C${c1[0]},${Math.min(c1[1], H - P.b)} ${c2[0]},${Math.min(c2[1], H - P.b)} ${px},${py}`;
  }, "");
  const area = `${path} L${x(data.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`;
  const s = data[sel];
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div>
      <p className="mb-1 text-xs text-muted">Últimos 12 meses: <strong className="text-ink tnum">{brl(total)}</strong></p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Faturamento mensal dos últimos 12 meses">
        <defs>
          <linearGradient id="dash-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#8a3d5c" stopOpacity=".28" />
            <stop offset="1" stopColor="#8a3d5c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {data.map((_, i) => <line key={i} x1={x(i)} x2={x(i)} y1={P.t - 6} y2={H - P.b} stroke="#efe5e0" />)}
        <path d={area} fill="url(#dash-area)" />
        <path d={path} fill="none" stroke="#8a3d5c" strokeWidth="2.5" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={i} onClick={() => setSel(i)} className="cursor-pointer">
            <rect x={x(i) - 22} y={0} width={44} height={H} fill="transparent" />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" fill={i === sel ? "#2b1d24" : "#8a7880"}>{d.label}</text>
          </g>
        ))}
        {s && (
          <g>
            <circle cx={x(sel)} cy={y(s.value)} r="5" fill="#fff" stroke="#8a3d5c" strokeWidth="2.5" />
            <g transform={`translate(${Math.min(Math.max(x(sel), 50), W - 50)}, ${Math.max(y(s.value) - 16, 14)})`}>
              <rect x="-46" y="-13" width="92" height="22" rx="6" fill="#2b1d24" />
              <text textAnchor="middle" y="3" fontSize="12" fill="#fff" fontWeight="600">{brl(s.value)}</text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

/** Barras por dia dos últimos 7 dias. */
export function BarChart({ data }: { data: { label: string; value: number; highlight?: boolean }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div>
      <p className="mb-3 text-xs text-muted">Últimos 7 dias: <strong className="text-ink tnum">{brl(total)}</strong></p>
      <div className="flex h-40 items-end justify-between gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={brl(d.value)}>
            {d.value > 0 && <span className="text-[10px] text-muted tnum">{d.value >= 1000 ? `${Math.round(d.value / 100) / 10}k` : Math.round(d.value)}</span>}
            <div
              className={cx("w-full max-w-7 rounded-full", d.value === 0 ? "bg-line" : d.highlight ? "bg-berry" : "bg-[#d9a2b6]")}
              style={{ height: d.value === 0 ? 8 : `${Math.max(8, (d.value / max) * 100)}%` }}
            />
            <span className={cx("text-xs", d.highlight ? "font-semibold text-ink" : "text-muted")}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
