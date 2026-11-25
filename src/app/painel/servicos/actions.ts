"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type Result = { ok: true } | { ok: false; error: string };

const serviceSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Informe o nome do serviço."),
  category: z.string().trim().max(80),
  description: z.string().trim().max(1000),
  durationMinutes: z.number().int().min(5, "Duração mínima de 5 minutos.").max(720),
  bufferMinutes: z.number().int().min(0).max(240),
  priceCents: z.number().int().min(0),
  priceFrom: z.boolean(),
  active: z.boolean(),
  onlineVisible: z.boolean(),
  professionalIds: z.array(z.uuid()).min(1, "Escolha pelo menos uma profissional que faz este serviço."),
});

export async function saveServiceAction(input: z.input<typeof serviceSchema>): Promise<Result> {
  const ctx = await requirePermission("services.manage");
  const p = serviceSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { id, professionalIds, ...data } = p.data;
  const validPros = await db.select({ id: schema.professionals.id }).from(schema.professionals)
    .where(and(eq(schema.professionals.organizationId, ctx.org.id), inArray(schema.professionals.id, professionalIds)));
  if (validPros.length !== professionalIds.length) return { ok: false, error: "Profissional inválida." };

  await db.transaction(async (tx) => {
    let serviceId = id;
    if (id) {
      const [existing] = await tx.select().from(schema.services).where(and(eq(schema.services.id, id), eq(schema.services.organizationId, ctx.org.id))).limit(1);
      if (!existing) throw new Error("not found");
      await tx.update(schema.services).set(data).where(eq(schema.services.id, id));
    } else {
      const [{ n }] = await tx.select({ n: count() }).from(schema.services).where(eq(schema.services.organizationId, ctx.org.id));
      const [created] = await tx.insert(schema.services).values({ ...data, organizationId: ctx.org.id, sortOrder: n }).returning();
      serviceId = created.id;
    }
    await tx.delete(schema.professionalServices).where(eq(schema.professionalServices.serviceId, serviceId!));
    await tx.insert(schema.professionalServices).values(professionalIds.map((pid) => ({ organizationId: ctx.org.id, professionalId: pid, serviceId: serviceId! })));
    await tx.insert(schema.auditLogs).values({
      organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: id ? "service.updated" : "service.created",
      entity: "service", entityId: serviceId!, data: { name: data.name, priceCents: data.priceCents, durationMinutes: data.durationMinutes },
    });
  });
  revalidatePath("/painel/servicos");
  return { ok: true };
}

export async function deleteServiceAction(id: string): Promise<Result> {
  const ctx = await requirePermission("services.manage");
  const [s] = await db.select().from(schema.services).where(and(eq(schema.services.id, id), eq(schema.services.organizationId, ctx.org.id))).limit(1);
  if (!s) return { ok: false, error: "Serviço não encontrado." };
  const [{ n }] = await db.select({ n: count() }).from(schema.appointments).where(eq(schema.appointments.serviceId, id));
  if (n > 0) {
    await db.update(schema.services).set({ active: false, onlineVisible: false }).where(eq(schema.services.id, id));
  } else {
    await db.delete(schema.services).where(eq(schema.services.id, id));
  }
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: n > 0 ? "service.deactivated" : "service.deleted", entity: "service", entityId: id, data: { name: s.name } });
  revalidatePath("/painel/servicos");
  return { ok: true };
}

export async function moveServiceAction(id: string, dir: -1 | 1): Promise<Result> {
  const ctx = await requirePermission("services.manage");
  const list = await db.select({ id: schema.services.id }).from(schema.services)
    .where(eq(schema.services.organizationId, ctx.org.id)).orderBy(schema.services.sortOrder, schema.services.name);
  const i = list.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  await db.transaction(async (tx) => {
    for (let k = 0; k < list.length; k++) await tx.update(schema.services).set({ sortOrder: k }).where(eq(schema.services.id, list[k].id));
  });
  revalidatePath("/painel/servicos");
  return { ok: true };
}
