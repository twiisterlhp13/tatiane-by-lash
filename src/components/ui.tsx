import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-rimel text-white hover:bg-rimel-2",
  secondary: "bg-white text-ink border border-line-2 hover:border-rimel",
  ghost: "text-ink-2 hover:bg-paper-2",
  danger: "bg-white text-danger border border-danger/40 hover:bg-danger-soft",
};
const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 min-h-12 text-[15px] font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cx(base, variants[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(base, variants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-[22px] bg-card border border-line", className)} {...props} />;
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl border border-line-2 bg-white px-4 min-h-[50px] text-[16px] text-ink placeholder:text-muted/80 focus:border-rimel focus:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputCls, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputCls, "py-2.5 min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputCls, "pr-8 appearance-auto", className)} {...props} />;
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cx("flex items-start gap-3 text-sm text-ink-2 cursor-pointer", className)}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-black" {...props} />
      <span>{label}</span>
    </label>
  );
}

type Tone = "neutral" | "ok" | "warn" | "danger" | "berry";
const tones: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-2",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  berry: "bg-gel text-gel-ink",
};
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function Alert({ tone = "danger", children }: { tone?: Tone; children: ReactNode }) {
  if (!children) return null;
  return <div role="alert" className={cx("rounded-2xl px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 lg:mb-6">
      <div>
        {/* o título aparece na barra superior do painel */}
        <span className="sr-only">{title}</span>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-dashed border-line-2 bg-white/60 px-6 py-10 text-center">
      <p className="text-lg font-bold">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled_by_client: "Cancelado pela cliente",
  cancelled_by_business: "Cancelado pelo negócio",
  no_show: "Não compareceu",
  rescheduled: "Reagendado",
};

export const STATUS_TONE: Record<string, Tone> = {
  pending: "warn",
  confirmed: "berry",
  completed: "ok",
  cancelled_by_client: "danger",
  cancelled_by_business: "danger",
  no_show: "neutral",
  rescheduled: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>;
}
