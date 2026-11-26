import { and, count, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/permissions";
import { appUrl } from "@/lib/notify";
import { logoutAction } from "../(auth)/actions";
import { PanelShell, type NavItem } from "./nav";
import { InstallPrompt } from "./install-prompt";

export const metadata = { title: "Painel", manifest: "/manifest.webmanifest" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const [{ n: pending }] = await db
    .select({ n: count() })
    .from(schema.appointments)
    .where(and(
      eq(schema.appointments.organizationId, ctx.org.id),
      eq(schema.appointments.status, "pending"),
      gte(schema.appointments.startsAt, new Date()),
      ctx.can("agenda.view_all") ? undefined : eq(schema.appointments.professionalId, ctx.professionalId ?? "00000000-0000-0000-0000-000000000000"),
    ));

  const items: NavItem[] = [
    { href: "/painel/agenda", label: "Agenda semanal", icon: "calendar" },
    { href: "/painel/horarios-livres", label: "Horários livres", icon: "free" },
    { href: "#meu-link", label: "Meu link", icon: "share" },
    { href: "/painel", label: "Dashboard", icon: "dashboard", badge: pending },
    ...(ctx.can("reports.view") ? [{ href: "/painel/faturamento", label: "Faturamento", icon: "money" as const }] : []),
    { href: "/painel/clientes", label: "Clientes", icon: "users" },
    ...(ctx.can("services.manage") ? [{ href: "/painel/servicos", label: "Serviços", icon: "sparkles" as const }] : []),
    { href: "/painel/configuracoes", label: "Configurações", icon: "settings" },
  ];

  return (
    <PanelShell
      items={items}
      orgName={ctx.org.name}
      userName={ctx.user.name}
      roleLabel={ROLE_LABEL[ctx.role]}
      publicUrl={`${appUrl()}/${ctx.org.slug}`}
      logout={logoutAction}
    >
      <InstallPrompt />
      {children}
    </PanelShell>
  );
}
