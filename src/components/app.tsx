import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* Botões ----------------------------------------------------------------- */

export const btn = {
  primary:
    "inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-rimel px-6 text-[15px] font-semibold text-white transition-colors hover:bg-rimel-2 disabled:opacity-40 disabled:pointer-events-none",
  secondary:
    "inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border border-line-2 bg-white px-6 text-[15px] font-semibold text-ink transition-colors hover:border-rimel disabled:opacity-40 disabled:pointer-events-none",
  text: "inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-[14px] font-semibold text-ink underline-offset-4 hover:underline",
  mini: "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-line-2 bg-white px-3.5 text-[13px] font-semibold text-ink transition-colors hover:border-rimel disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap",
  miniOk:
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-rimel px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-rimel-2 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap",
  icon: "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line-2 bg-white text-ink transition-colors hover:border-rimel",
};

export const inputCls =
  "w-full min-h-[50px] rounded-2xl border border-line-2 bg-white px-4 text-[16px] text-ink placeholder:text-muted/80 focus:border-rimel focus:outline-none";

/* Estrutura -------------------------------------------------------------- */

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-1">
      <h1 className="text-[28px] font-bold leading-tight">{children}</h1>
      {sub && <p className="mt-1 text-[14px] text-muted">{sub}</p>}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mt-8 mb-3 flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-[19px] font-bold">{children}</h2>
      {action}
    </div>
  );
}

/** Lista agrupada: um bloco branco com linhas separadas por fios (em vez de um cartão por item). */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-white", className)}>{children}</div>;
}

export function Row({ children, className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cx("flex items-center gap-3.5 px-4 py-3.5", className)} {...props}>
      {children}
    </div>
  );
}

export function RowLink({ children, className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link className={cx("flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-paper", className)} {...props}>
      {children}
    </Link>
  );
}

/** Bloco de horário à esquerda de uma linha da agenda. */
export function TimeCell({ time, sub }: { time: string; sub?: string }) {
  return (
    <div className="w-[58px] shrink-0 border-r border-line pr-3">
      <div className="tnum text-[17px] font-bold leading-tight">{time}</div>
      {sub && <div className="tnum text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

type Tone = "gel" | "neutral" | "ok" | "warn" | "danger" | "rimel";
const tones: Record<Tone, string> = {
  gel: "bg-gel text-gel-ink",
  neutral: "bg-paper-2 text-ink-2",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  rimel: "bg-rimel text-white",
};
export function Tag({ tone = "gel", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-[3px] text-[12px] font-semibold", tones[tone], className)}>{children}</span>;
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-dashed border-line-2 px-5 py-7 text-center">
      <p className="mx-auto max-w-sm text-[14px] text-muted">{children}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("mt-3 text-[13px] leading-relaxed text-muted", className)}>{children}</p>;
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">
      {children}
      {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
    </span>
  );
}

/* Status dos agendamentos na linguagem do app ----------------------------- */

export const STATUS_APP: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pedido novo", tone: "warn" },
  confirmed: { label: "Confirmado", tone: "gel" },
  completed: { label: "Concluído", tone: "ok" },
  cancelled_by_client: { label: "Cancelado pela cliente", tone: "danger" },
  cancelled_by_business: { label: "Cancelado", tone: "danger" },
  no_show: { label: "Faltou", tone: "neutral" },
  rescheduled: { label: "Remarcado", tone: "neutral" },
};

/** Para a cliente (Meus horários). */
export const STATUS_CLIENTE: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Aguardando confirmação", tone: "warn" },
  confirmed: { label: "Confirmado", tone: "ok" },
  completed: { label: "Concluído", tone: "neutral" },
  cancelled_by_client: { label: "Cancelado", tone: "danger" },
  cancelled_by_business: { label: "Cancelado", tone: "danger" },
  no_show: { label: "Faltou", tone: "neutral" },
  rescheduled: { label: "Remarcado", tone: "neutral" },
};

export function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

export function Avatar({ name, photo, size = 44, className }: { name: string; photo?: string | null; size?: number; className?: string }) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt="" width={size} height={size} className={cx("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
    );
  }
  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full bg-gel font-bold text-gel-ink", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
