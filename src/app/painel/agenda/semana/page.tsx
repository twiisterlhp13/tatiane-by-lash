import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { toLocalDate } from "@/lib/time";
import { AgendaClient } from "../agenda-client";

export const metadata = { title: "Agenda da semana" };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ novo?: string; data?: string; bloquear?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const viewAll = ctx.can("agenda.view_all");
  const [pros, services, links, hours] = await Promise.all([
    db.select().from(schema.professionals)
      .where(and(eq(schema.professionals.organizationId, ctx.org.id), eq(schema.professionals.active, true)))
      .orderBy(asc(schema.professionals.sortOrder), asc(schema.professionals.name)),
    db.select().from(schema.services)
      .where(and(eq(schema.services.organizationId, ctx.org.id), eq(schema.services.active, true)))
      .orderBy(asc(schema.services.sortOrder), asc(schema.services.name)),
    db.select().from(schema.professionalServices).where(eq(schema.professionalServices.organizationId, ctx.org.id)),
    db.select().from(schema.professionalHours).where(eq(schema.professionalHours.organizationId, ctx.org.id)),
  ]);
  const visiblePros = viewAll ? pros : pros.filter((p) => p.id === ctx.professionalId);
  const minStart = hours.length ? Math.min(...hours.map((h) => h.startMinute)) : 8 * 60;
  const maxEnd = hours.length ? Math.max(...hours.map((h) => h.endMinute)) : 20 * 60;

  return (
    <AgendaClient
      tz={ctx.org.timezone}
      today={toLocalDate(new Date(), ctx.org.timezone)}
      initialDate={sp.data}
      openNew={sp.novo === "1"}
      openBlock={sp.bloquear === "1"}
      professionals={visiblePros.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
      services={services.map((s) => ({
        id: s.id, name: s.name, durationMinutes: s.durationMinutes, priceCents: s.priceCents,
        professionalIds: links.filter((l) => l.serviceId === s.id).map((l) => l.professionalId),
      }))}
      canManageAll={ctx.can("agenda.manage_all")}
      ownProfessionalId={ctx.professionalId}
      startHour={Math.max(0, Math.floor(minStart / 60) - 1)}
      endHour={Math.min(24, Math.ceil(maxEnd / 60) + 1)}
    />
  );
}
