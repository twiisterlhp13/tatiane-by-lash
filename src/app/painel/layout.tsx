import { and, count, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/permissions";
import { appUrl } from "@/lib/notify";
import { logoutAction } from "../(auth)/actions";
import { PanelShell } from "./shell";

export const metadata = { title: "Painel" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const [[{ n: pending }], [org]] = await Promise.all([
    db
      .select({ n: count() })
      .from(schema.appointments)
      .where(and(
        eq(schema.appointments.organizationId, ctx.org.id),
        eq(schema.appointments.status, "pending"),
        gte(schema.appointments.startsAt, new Date()),
        ctx.can("agenda.view_all") ? undefined : eq(schema.appointments.professionalId, ctx.professionalId ?? "00000000-0000-0000-0000-000000000000"),
      )),
    db.select({ logoUrl: schema.organizations.logoUrl }).from(schema.organizations).where(eq(schema.organizations.id, ctx.org.id)),
  ]);

  return (
    <PanelShell
      pending={pending}
      orgName={ctx.org.name}
      userName={ctx.user.name}
      roleLabel={ROLE_LABEL[ctx.role]}
      photo={org?.logoUrl ?? null}
      publicUrl={`${appUrl()}/${ctx.org.slug}`}
      perms={{
        team: ctx.can("team.manage"),
        audit: ctx.can("audit.view"),
        settings: ctx.can("settings.manage"),
        services: ctx.can("services.manage"),
        hours: ctx.can("hours.manage") || !!ctx.professionalId,
        reports: ctx.can("reports.view"),
      }}
      logout={logoutAction}
    >
      {children}
    </PanelShell>
  );
}
