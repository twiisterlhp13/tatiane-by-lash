"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { clientIp, requireCtx, requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { isValidBrPhone, normalizePhone } from "@/lib/security";

export type FormState = { error?: string; ok?: string } | undefined;

const clientSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  phone: z.string().trim().refine(isValidBrPhone, "Telefone inválido. Use DDD + número."),
  email: z.union([z.email("E-mail inválido."), z.literal("")]),
  birthDate: z.union([z.iso.date(), z.literal("")]),
  notes: z.string().max(4000),
  marketingConsent: z.boolean(),
});

function parse(form: FormData) {
  return clientSchema.safeParse({
    name: form.get("name"), phone: form.get("phone"), email: String(form.get("email") ?? "").trim(),
    birthDate: String(form.get("birthDate") ?? ""), notes: String(form.get("notes") ?? ""), marketingConsent: form.get("marketingConsent") === "on",
  });
}

export async function createClientAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requirePermission("clients.manage");
  const p = parse(form);
  if (!p.success) return { error: p.error.issues[0].message };
  const phoneNormalized = normalizePhone(p.data.phone);
  const [dup] = await db.select({ id: schema.clients.id }).from(schema.clients)
    .where(and(eq(schema.clients.organizationId, ctx.org.id), eq(schema.clients.phoneNormalized, phoneNormalized), isNull(schema.clients.anonymizedAt))).limit(1);
  if (dup) return { error: "Já existe uma cliente com este telefone." };
  const [c] = await db.insert(schema.clients).values({
    organizationId: ctx.org.id, name: p.data.name, phone: p.data.phone, phoneNormalized, email: p.data.email,
    birthDate: p.data.birthDate || null, notes: p.data.notes, marketingConsent: p.data.marketingConsent,
    marketingConsentAt: p.data.marketingConsent ? new Date() : null,
  }).returning();
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "client.created", entity: "client", entityId: c.id });
  redirect(`/painel/clientes/${c.id}`);
}

export async function updateClientAction(id: string, _: FormState, form: FormData): Promise<FormState> {
  const ctx = await requirePermission("clients.manage");
  const p = parse(form);
  if (!p.success) return { error: p.error.issues[0].message };
  const [c] = await db.select().from(schema.clients).where(and(eq(schema.clients.id, id), eq(schema.clients.organizationId, ctx.org.id))).limit(1);
  if (!c || c.anonymizedAt) return { error: "Cliente não encontrada." };
  const phoneNormalized = normalizePhone(p.data.phone);
  if (phoneNormalized !== c.phoneNormalized) {
    const [dup] = await db.select({ id: schema.clients.id }).from(schema.clients)
      .where(and(eq(schema.clients.organizationId, ctx.org.id), eq(schema.clients.phoneNormalized, phoneNormalized), isNull(schema.clients.anonymizedAt))).limit(1);
    if (dup) return { error: "Já existe outra cliente com este telefone." };
  }
  await db.update(schema.clients).set({
    name: p.data.name, phone: p.data.phone, phoneNormalized, email: p.data.email, birthDate: p.data.birthDate || null, notes: p.data.notes,
    marketingConsent: p.data.marketingConsent,
    marketingConsentAt: p.data.marketingConsent ? (c.marketingConsent ? c.marketingConsentAt : new Date()) : null,
    updatedAt: new Date(),
  }).where(eq(schema.clients.id, c.id));
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "client.updated", entity: "client", entityId: c.id });
  revalidatePath(`/painel/clientes/${c.id}`);
  return { ok: "Dados salvos." };
}

/** LGPD: remove dados pessoais mantendo o histórico financeiro/agenda de forma anônima. */
export async function anonymizeClientAction(id: string) {
  const ctx = await requirePermission("clients.privacy");
  const [c] = await db.select().from(schema.clients).where(and(eq(schema.clients.id, id), eq(schema.clients.organizationId, ctx.org.id))).limit(1);
  if (!c) return;
  await db.update(schema.clients).set({
    name: "Cliente anonimizada", phone: "", phoneNormalized: `anon-${c.id}`, email: "", birthDate: null, notes: "",
    marketingConsent: false, marketingConsentAt: null, anonymizedAt: new Date(), updatedAt: new Date(),
  }).where(eq(schema.clients.id, c.id));
  await db.update(schema.appointments).set({ clientNotes: "", manageTokenHash: null }).where(eq(schema.appointments.clientId, c.id));
  await db.delete(schema.formAnswers).where(eq(schema.formAnswers.clientId, c.id));
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "client.anonymized", entity: "client", entityId: c.id, ip: await clientIp() });
  redirect("/painel/clientes?anonimizada=1");
}

void requireCtx;
