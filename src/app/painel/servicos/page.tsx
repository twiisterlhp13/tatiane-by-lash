import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ServicesManager } from "./services-manager";

export const metadata = { title: "Serviços" };

export default async function ServicesPage() {
  const ctx = await requirePermission("services.manage");
  const [services, pros, links] = await Promise.all([
    db.select().from(schema.services).where(eq(schema.services.organizationId, ctx.org.id)).orderBy(asc(schema.services.sortOrder), asc(schema.services.name)),
    db.select({ id: schema.professionals.id, name: schema.professionals.name }).from(schema.professionals).where(eq(schema.professionals.organizationId, ctx.org.id)).orderBy(asc(schema.professionals.name)),
    db.select().from(schema.professionalServices).where(eq(schema.professionalServices.organizationId, ctx.org.id)),
  ]);
  return (
    <>
      <PageHeader title="Serviços" subtitle="O que aparece na sua página de agendamento, com duração e preço." />
      <ServicesManager
        professionals={pros}
        services={services.map((s) => ({ ...s, professionalIds: links.filter((l) => l.serviceId === s.id).map((l) => l.professionalId) }))}
      />
    </>
  );
}
