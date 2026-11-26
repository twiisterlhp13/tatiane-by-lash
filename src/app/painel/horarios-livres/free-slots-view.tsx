"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Copy, MessageCircle } from "lucide-react";
import { Select, cx } from "@/components/ui";
import { addDays, fmtDuration } from "@/lib/time";

type Day = { date: string; label: string; byPro: { professionalId: string; name: string; times: string[] }[] };

export function FreeSlotsView(props: {
  from: string;
  today: string;
  services: { id: string; name: string; durationMinutes: number }[];
  professionals: { id: string; name: string }[];
  serviceId: string;
  prof: string;
  days: Day[];
  orgName: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const service = props.services.find((s) => s.id === props.serviceId)!;
  const go = (o: Record<string, string>) => {
    const q = new URLSearchParams({ servico: props.serviceId, prof: props.prof, de: props.from, ...o });
    router.push(`/painel/horarios-livres?${q}`);
  };
  const multi = props.professionals.length > 1 && props.prof === "all";

  function textFor(day: Day) {
    const times = [...new Set(day.byPro.flatMap((p) => p.times))].sort();
    return `Horários disponíveis para *${service.name}* – ${day.label}:\n${times.join(" · ")}\n\n${props.orgName}`;
  }
  function textWeek() {
    const parts = props.days
      .map((d) => ({ d, times: [...new Set(d.byPro.flatMap((p) => p.times))].sort() }))
      .filter((x) => x.times.length)
      .map((x) => `*${x.d.label}*\n${x.times.join(" · ")}`);
    return `Horários disponíveis para *${service.name}*:\n\n${parts.join("\n\n")}\n\n${props.orgName}`;
  }
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copie o texto:", text);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <Select value={props.serviceId} onChange={(e) => go({ servico: e.target.value })} aria-label="Serviço">
          {props.services.map((s) => <option key={s.id} value={s.id}>{s.name} · {fmtDuration(s.durationMinutes)}</option>)}
        </Select>
        {props.professionals.length > 1 && (
          <Select value={props.prof} onChange={(e) => go({ prof: e.target.value })} aria-label="Profissional">
            <option value="all">Todas as profissionais</option>
            {props.professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
      </div>
      <div className="mb-4 flex items-center justify-between">
        <button disabled={props.from <= props.today} onClick={() => go({ de: addDays(props.from, -7) < props.today ? props.today : addDays(props.from, -7) })}
          className="rounded-full p-2 text-ink-2 hover:bg-white disabled:opacity-30" aria-label="Semana anterior"><ChevronLeft size={20} /></button>
        <button onClick={() => copy("week", textWeek())} className="inline-flex items-center gap-2 rounded-full bg-berry px-4 py-2 text-sm font-medium text-white shadow-sm">
          {copied === "week" ? <Check size={16} /> : <MessageCircle size={16} />} {copied === "week" ? "Copiado!" : "Copiar a semana para o WhatsApp"}
        </button>
        <button onClick={() => go({ de: addDays(props.from, 7) })} className="rounded-full p-2 text-ink-2 hover:bg-white" aria-label="Próxima semana"><ChevronRight size={20} /></button>
      </div>

      <div className="space-y-3">
        {props.days.map((d) => {
          const total = d.byPro.reduce((s, p) => s + p.times.length, 0);
          return (
            <section key={d.date} className="rounded-2xl border border-line bg-white p-4 shadow-[var(--shadow-soft)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className={cx("font-medium", d.date === props.today && "text-berry")}>{d.date === props.today ? `Hoje · ${d.label}` : d.label}</h2>
                {total > 0 && (
                  <button onClick={() => copy(d.date, textFor(d))} className="inline-flex items-center gap-1 text-xs font-medium text-berry">
                    {copied === d.date ? <Check size={14} /> : <Copy size={14} />} {copied === d.date ? "Copiado" : "Copiar"}
                  </button>
                )}
              </div>
              {total === 0 ? (
                <p className="text-sm text-muted">Sem horários livres.</p>
              ) : (
                d.byPro.filter((p) => p.times.length).map((p) => (
                  <div key={p.professionalId} className="mt-1">
                    {multi && <p className="mb-1 text-xs text-muted">{p.name}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {p.times.map((t) => (
                        <span key={t} className="rounded-lg bg-berry-soft px-2.5 py-1 text-sm font-medium text-berry tnum">{t}</span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
