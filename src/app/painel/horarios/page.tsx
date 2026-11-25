import { and, asc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { minutesToHHMM, toLocalDate } from "@/lib/time";
import { PageHeader } from "@/components/ui";
import { HoursEditor } from "./hours-editor";

export const metadata = { title: "Horários" };

export default async function HoursPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const all = await db.select({ id: schema.professionals.id, name: schema.professionals.name }).from(schema.professionals)
    .where(and(eq(schema.professionals.organizationId, ctx.org.id), eq(schema.professionals.active, true))).orderBy(asc(schema.professionals.sortOrder), asc(schema.professionals.name));
  const pros = ctx.can("hours.manage") ? all : all.filter((p) => p.id === ctx.professionalId);
  const selected = pros.find((p) => p.id === sp.p) ?? pros.find((p) => p.id === ctx.professionalId) ?? pros[0];
  if (!selected) return <PageHeader title="Horários" subtitle="Nenhuma profissional ativa." />;
  const [hours, special] = await Promise.all([
    db.select().from(schema.professionalHours).where(eq(schema.professionalHours.professionalId, selected.id)),
    db.select().from(schema.specialHours)
      .where(and(eq(schema.specialHours.professionalId, selected.id), gte(schema.specialHours.date, toLocalDate(new Date(), ctx.org.timezone))))
      .orderBy(asc(schema.specialHours.date)),
  ]);
  const days = Array.from({ length: 7 }, (_, wd) => ({
    weekday: wd,
    intervals: hours.filter((h) => h.weekday === wd).sort((a, b) => a.startMinute - b.startMinute)
      .map((h) => ({ start: minutesToHHMM(h.startMinute), end: minutesToHHMM(h.endMinute) })),
  }));
  return (
    <>
      <PageHeader title="Horários de atendimento" subtitle="Os horários livres para as clientes são calculados a partir daqui, descontando agendamentos e bloqueios." />
      <HoursEditor
        key={selected.id}
        professionals={pros}
        selectedId={selected.id}
        days={days}
        canManageAll={ctx.can("hours.manage")}
        special={special.map((s) => ({ id: s.id, date: s.date, closed: s.endMinute <= s.startMinute, start: minutesToHHMM(s.startMinute), end: minutesToHHMM(s.endMinute), note: s.note }))}
      />
    </>
  );
}
