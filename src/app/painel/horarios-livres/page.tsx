import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { loadSchedules } from "@/lib/booking";
import { slotsForDate } from "@/lib/availability";
import { addDays, fmtLocalDateLong, fmtTime, isValidLocalDate, localToUtc, toLocalDate } from "@/lib/time";
import { EmptyState } from "@/components/ui";
import { FreeSlotsView } from "./free-slots-view";

export const metadata = { title: "Horários livres" };

const DAYS = 7;

export default async function FreeSlotsPage({ searchParams }: { searchParams: Promise<{ servico?: string; prof?: string; de?: string }> }) {
  const ctx = await requireCtx();
  const tz = ctx.org.timezone;
  const sp = await searchParams;
  const today = toLocalDate(new Date(), tz);
  const from = sp.de && isValidLocalDate(sp.de) && sp.de >= today ? sp.de : today;

  const [services, pros, links] = await Promise.all([
    db.select().from(schema.services).where(and(eq(schema.services.organizationId, ctx.org.id), eq(schema.services.active, true)))
      .orderBy(asc(schema.services.sortOrder), asc(schema.services.name)),
    db.select().from(schema.professionals).where(and(eq(schema.professionals.organizationId, ctx.org.id), eq(schema.professionals.active, true)))
      .orderBy(asc(schema.professionals.sortOrder), asc(schema.professionals.name)),
    db.select().from(schema.professionalServices).where(eq(schema.professionalServices.organizationId, ctx.org.id)),
  ]);
  if (services.length === 0 || pros.length === 0) {
    return <EmptyState title="Cadastre serviços e horários primeiro">Os horários livres são calculados a partir dos serviços e do horário de atendimento.</EmptyState>;
  }
  const visiblePros = ctx.can("agenda.view_all") ? pros : pros.filter((p) => p.id === ctx.professionalId);
  const service = services.find((s) => s.id === sp.servico) ?? services[0];
  const proIds = visiblePros
    .filter((p) => links.some((l) => l.professionalId === p.id && l.serviceId === service.id))
    .filter((p) => !sp.prof || sp.prof === "all" || p.id === sp.prof)
    .map((p) => p.id);

  const start = localToUtc(from, 0, tz);
  const end = localToUtc(addDays(from, DAYS), 0, tz);
  const schedules = await loadSchedules(db, ctx.org.id, proIds, new Date(start.getTime() - 86400000), new Date(end.getTime() + 86400000), tz);
  const rules = {
    durationMinutes: service.durationMinutes,
    bufferMinutes: service.bufferMinutes,
    stepMinutes: ctx.org.settings.slotIntervalMinutes,
    earliest: new Date(),
    latest: end,
  };

  const days = Array.from({ length: DAYS }, (_, i) => {
    const date = addDays(from, i);
    const byPro = schedules.map((s) => ({
      professionalId: s.professionalId,
      name: visiblePros.find((p) => p.id === s.professionalId)?.name ?? "",
      times: slotsForDate(s, date, rules, tz).map((d) => fmtTime(d, tz)),
    }));
    return { date, label: fmtLocalDateLong(date), byPro };
  });

  return (
    <FreeSlotsView
      from={from}
      today={today}
      services={services.map((s) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes }))}
      professionals={visiblePros.map((p) => ({ id: p.id, name: p.name }))}
      serviceId={service.id}
      prof={sp.prof ?? "all"}
      days={days}
      orgName={ctx.org.name}
    />
  );
}
