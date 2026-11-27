import type { CSSProperties } from "react";

/** Os fios da marca: linha da pálpebra + 7 cílios (mesma geometria da abertura e do ícone do app). */
export const LASHES = [
  "M13.0 28.6Q8.7 25.0 6.8 22.0",
  "M20.2 25.8Q16.4 20.1 14.9 15.6",
  "M27.5 24.3Q25.2 17.2 25.1 11.5",
  "M34.2 24.1Q35.9 16.7 35.5 10.6",
  "M41.0 25.0Q44.6 18.1 45.8 12.4",
  "M47.7 27.1Q52.6 21.6 55.0 17.0",
  "M54.4 30.4Q59.6 26.7 62.4 23.6",
];
export const LID = "M4 34Q32 14 60 34";

/** Marca: pálpebra com cílios. `animated` desenha fio a fio (usado só na abertura). */
export function LashMark({ size = 28, animated = false, className, style, strokeWidth = 2.6 }: {
  size?: number;
  animated?: boolean;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="2 6 64 32"
      width={size}
      height={size / 2}
      className={[animated ? "fio-a-fio" : "", className].filter(Boolean).join(" ")}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path className="palpebra" d={LID} />
      {LASHES.map((d, i) => (
        <path key={d} d={d} style={animated ? { animationDelay: `${0.7 + i * 0.16}s` } : undefined} />
      ))}
    </svg>
  );
}

/** Nome da marca como a cliente escreve: TATIANE By Lash. */
export function Wordmark({ size = "md", className }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const s = {
    sm: { t: "text-[15px]", b: "text-[13px]", mark: 22 },
    md: { t: "text-[19px]", b: "text-[15px]", mark: 26 },
    lg: { t: "text-[26px]", b: "text-[20px]", mark: 34 },
    xl: { t: "text-[34px]", b: "text-[26px]", mark: 44 },
  }[size];
  return (
    <span className={["inline-flex items-center gap-2 leading-none", className].filter(Boolean).join(" ")}>
      <LashMark size={s.mark} />
      <span className="whitespace-nowrap">
        <span className={`${s.t} font-extrabold tracking-[0.16em]`}>TATIANE</span>
        <span className={`${s.b} ml-1.5 font-normal tracking-normal`}>By Lash</span>
      </span>
    </span>
  );
}
