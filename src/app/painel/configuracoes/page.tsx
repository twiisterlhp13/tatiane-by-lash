import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Ban, BellRing, Building2, CalendarCog, ChevronRight, Clock, History, KeyRound, MessageSquareText, Smartphone, Sparkles, Users,
} from "lucide-react";
import { requireCtx } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";

export const metadata = { title: "Configurações" };

type Entry = { href: string; label: string; hint?: string; icon: LucideIcon; perm?: Permission };
const GROUPS: { title: string; items: Entry[] }[] = [
  {
    title: "Configurações da agenda",
    items: [
      { href: "/painel/horarios", label: "Horário de atendimento", hint: "Dias, horários e pausas", icon: Clock },
      { href: "/painel/configuracoes/agendamento", label: "Agenda do cliente", hint: "Agendamento online, antecedência e cancelamento", icon: CalendarCog, perm: "settings.manage" },
      { href: "/painel/notificacoes", label: "Mensagens automáticas", hint: "Confirmações e lembretes", icon: MessageSquareText, perm: "settings.manage" },
      { href: "/painel/agenda?bloquear=1", label: "Bloquear horários", hint: "Folgas, férias e compromissos", icon: Ban },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { href: "/painel/equipe", label: "Profissionais", hint: "Equipe e acessos ao painel", icon: Users, perm: "team.manage" },
      { href: "/painel/servicos", label: "Serviços", hint: "Duração, preço e quem atende", icon: Sparkles, perm: "services.manage" },
    ],
  },
  {
    title: "Empresa e site",
    items: [
      { href: "/painel/configuracoes/empresa", label: "Perfil da empresa", hint: "Nome, link, endereço, contato e fotos", icon: Building2, perm: "settings.manage" },
    ],
  },
  {
    title: "Segurança",
    items: [
      { href: "/recuperar-senha", label: "Alterar senha", hint: "Enviamos um link para o seu e-mail", icon: KeyRound },
      { href: "/painel/auditoria", label: "Histórico de ações", hint: "Quem fez o quê no painel", icon: History, perm: "audit.view" },
    ],
  },
];

export default async function SettingsHub() {
  const ctx = await requireCtx();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => !i.perm || ctx.can(i.perm));
        if (items.length === 0) return null;
        return (
          <section key={g.title} className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-soft)]">
            <h2 className="px-4 pb-1 pt-3 text-xs font-medium text-muted">{g.title}</h2>
            <ul>
              {items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className="flex items-center gap-4 px-4 py-3.5 hover:bg-paper-2/60">
                    <i.icon size={21} strokeWidth={1.8} className="shrink-0 text-ink-2" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px]">{i.label}</span>
                      {i.hint && <span className="block truncate text-xs text-muted">{i.hint}</span>}
                    </span>
                    <ChevronRight size={18} className="text-line-2" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-soft)]">
        <h2 className="px-4 pb-1 pt-3 text-xs font-medium text-muted">Dispositivo</h2>
        <div className="flex items-center gap-4 px-4 py-3.5">
          <Smartphone size={21} strokeWidth={1.8} className="text-ink-2" />
          <span className="text-sm text-ink-2">Para usar como app no Android: no Chrome, toque em ⋮ → <strong>Instalar app</strong>.</span>
        </div>
        <div className="flex items-center gap-4 px-4 pb-4 pt-1">
          <BellRing size={21} strokeWidth={1.8} className="text-ink-2" />
          <span className="text-sm text-ink-2">A agenda se atualiza sozinha a cada 20 segundos enquanto estiver aberta.</span>
        </div>
      </section>
    </div>
  );
}
