"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { CATEGORIAS_DESPESA } from "@/lib/lash";
import { isValidLocalDate } from "@/lib/time";

export type R = { ok: true } | { ok: false; error: string };

const despesaSchema = z.object({
  description: z.string().trim().min(2, "Informe a descrição.").max(200),
  amount: z.number({ error: "Informe o valor." }).min(0, "Valor inválido.").max(1_000_000),
  category: z.enum(CATEGORIAS_DESPESA),
  date: z.string().refine(isValidLocalDate, "Data inválida."),
});

export async function addDespesaAction(input: z.input<typeof despesaSchema>): Promise<R> {
  const ctx = await requireCtx();
  if (!ctx.can("reports.view")) return { ok: false, error: "Sem permissão para o financeiro." };
  const p = despesaSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const [row] = await db.insert(schema.expenses).values({
    organizationId: ctx.org.id,
    description: p.data.description,
    category: p.data.category,
    amountCents: Math.round(p.data.amount * 100),
    spentOn: p.data.date,
    createdByUserId: ctx.user.id,
  }).returning();
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "expense.created", entity: "expense", entityId: row.id, data: { amountCents: row.amountCents } });
  revalidatePath("/painel/negocio");
  revalidatePath("/painel");
  return { ok: true };
}

export async function deleteDespesaAction(id: string): Promise<R> {
  const ctx = await requireCtx();
  if (!ctx.can("reports.view")) return { ok: false, error: "Sem permissão para o financeiro." };
  const del = await db.delete(schema.expenses).where(and(eq(schema.expenses.id, id), eq(schema.expenses.organizationId, ctx.org.id))).returning({ id: schema.expenses.id });
  if (!del.length) return { ok: false, error: "Despesa não encontrada." };
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "expense.deleted", entity: "expense", entityId: id });
  revalidatePath("/painel/negocio");
  return { ok: true };
}

const itemSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do item.").max(120),
  quantity: z.number({ error: "Informe a quantidade." }).int("Use números inteiros.").min(0).max(100000),
  minimum: z.number().int("Use números inteiros.").min(0).max(100000),
  unit: z.string().trim().min(1).max(20),
});

export async function addItemAction(input: z.input<typeof itemSchema>): Promise<R> {
  const ctx = await requireCtx();
  const p = itemSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  await db.insert(schema.inventoryItems).values({ organizationId: ctx.org.id, ...p.data });
  revalidatePath("/painel/negocio");
  revalidatePath("/painel");
  return { ok: true };
}

export async function changeQtyAction(id: string, delta: number): Promise<R & { quantity?: number }> {
  const ctx = await requireCtx();
  const d = Math.max(-1000, Math.min(1000, Math.round(delta)));
  const [row] = await db.update(schema.inventoryItems)
    .set({ quantity: sql`greatest(0, ${schema.inventoryItems.quantity} + ${d})`, updatedAt: new Date() })
    .where(and(eq(schema.inventoryItems.id, id), eq(schema.inventoryItems.organizationId, ctx.org.id)))
    .returning({ quantity: schema.inventoryItems.quantity });
  if (!row) return { ok: false, error: "Item não encontrado." };
  revalidatePath("/painel");
  return { ok: true, quantity: row.quantity };
}

export async function deleteItemAction(id: string): Promise<R> {
  const ctx = await requireCtx();
  const del = await db.delete(schema.inventoryItems).where(and(eq(schema.inventoryItems.id, id), eq(schema.inventoryItems.organizationId, ctx.org.id))).returning({ id: schema.inventoryItems.id });
  if (!del.length) return { ok: false, error: "Item não encontrado." };
  revalidatePath("/painel/negocio");
  return { ok: true };
}
