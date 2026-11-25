"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { RESERVED_SLUGS, slugify } from "@/lib/security";
import { defaultOrgSettings } from "@/db/schema";
import { DEFAULT_TEMPLATES, type TemplateKey } from "@/lib/notify";

export type FormState = { error?: string; ok?: string } | undefined;

const optionalUrl = z.union([z.url("Link inválido."), z.literal("")]);

export async function saveProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requirePermission("settings.manage");
  const s = z.object({
    name: z.string().trim().min(2, "Informe o nome."),
    slug: z.string().trim(),
    description: z.string().trim().max(1500),
    phone: z.string().trim().max(30),
    whatsapp: z.string().trim().max(30),
    email: z.union([z.email("E-mail inválido."), z.literal("")]),
    instagram: z.string().trim().max(60),
    address: z.string().trim().max(250),
    logoUrl: optionalUrl,
    coverUrl: optionalUrl,
  }).safeParse(Object.fromEntries(form));
  if (!s.success) return { error: s.error.issues[0].message };
  const slug = slugify(s.data.slug);
  if (slug.length < 3) return { error: "O link precisa ter pelo menos 3 letras." };
  if (RESERVED_SLUGS.has(slug)) return { error: "Este link é reservado pelo sistema. Escolha outro." };
  const [taken] = await db.select({ id: schema.organizations.id }).from(schema.organizations)
    .where(and(eq(schema.organizations.slug, slug), ne(schema.organizations.id, ctx.org.id))).limit(1);
  if (taken) return { error: "Este link já está em uso por outro negócio." };
  await db.update(schema.organizations).set({
    ...s.data, slug, logoUrl: s.data.logoUrl || null, coverUrl: s.data.coverUrl || null,
    instagram: s.data.instagram.replace(/^@/, ""), updatedAt: new Date(),
  }).where(eq(schema.organizations.id, ctx.org.id));
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "organization.profile_updated", entity: "organization", entityId: ctx.org.id, data: { slug } });
  revalidatePath("/", "layout");
  return { ok: slug !== ctx.org.slug ? "Salvo. Atenção: seu link público mudou, atualize onde você divulgou." : "Dados salvos." };
}

export async function saveBookingSettingsAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requirePermission("settings.manage");
  const num = (k: string, min: number, max: number) => {
    const n = Number(form.get(k));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null;
  };
  const values = {
    slotIntervalMinutes: num("slotIntervalMinutes", 5, 240),
    minAdvanceMinutes: num("minAdvanceHours", 0, 720) === null ? null : num("minAdvanceHours", 0, 720)! * 60,
    maxAdvanceDays: num("maxAdvanceDays", 1, 365),
    cancelUntilHours: num("cancelUntilHours", 0, 720),
    rescheduleUntilHours: num("rescheduleUntilHours", 0, 720),
  };
  if (Object.values(values).some((v) => v === null)) return { error: "Confira os números informados." };
  const settings = {
    ...defaultOrgSettings,
    ...ctx.org.settings,
    ...(values as Record<string, number>),
    autoConfirmOnline: form.get("autoConfirmOnline") === "on",
    requireEmail: form.get("requireEmail") === "on",
    requireCancelReason: form.get("requireCancelReason") === "on",
    policyText: String(form.get("policyText") ?? "").slice(0, 2000),
  };
  await db.update(schema.organizations).set({
    settings, onlineBookingEnabled: form.get("onlineBookingEnabled") === "on", updatedAt: new Date(),
  }).where(eq(schema.organizations.id, ctx.org.id));
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "organization.booking_settings_updated", entity: "organization", entityId: ctx.org.id, data: settings });
  revalidatePath("/", "layout");
  return { ok: "Regras de agendamento salvas." };
}

export async function saveNotificationSettingsAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requirePermission("settings.manage");
  const email = String(form.get("notifyBusinessEmail") ?? "").trim();
  if (email && !z.email().safeParse(email).success) return { error: "E-mail inválido." };
  const settings = {
    ...defaultOrgSettings,
    ...ctx.org.settings,
    notifyBusinessEmail: email,
    reminder24h: form.get("reminder24h") === "on",
    reminder2h: form.get("reminder2h") === "on",
  };
  await db.update(schema.organizations).set({ settings, updatedAt: new Date() }).where(eq(schema.organizations.id, ctx.org.id));
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "organization.notification_settings_updated", entity: "organization", entityId: ctx.org.id });
  revalidatePath("/painel/notificacoes");
  return { ok: "Preferências salvas." };
}

export async function saveTemplateAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requirePermission("settings.manage");
  const key = String(form.get("key")) as TemplateKey;
  if (!(key in DEFAULT_TEMPLATES)) return { error: "Modelo inválido." };
  const subject = String(form.get("subject") ?? "").slice(0, 200);
  const body = String(form.get("body") ?? "").slice(0, 4000);
  const enabled = form.get("enabled") === "on";
  if (form.get("reset") === "1") {
    await db.delete(schema.messageTemplates).where(and(eq(schema.messageTemplates.organizationId, ctx.org.id), eq(schema.messageTemplates.key, key)));
    revalidatePath("/painel/notificacoes");
    return { ok: "Modelo restaurado para o padrão." };
  }
  if (!body.trim()) return { error: "A mensagem não pode ficar vazia." };
  await db.insert(schema.messageTemplates).values({ organizationId: ctx.org.id, key, channel: "email", subject, body, enabled })
    .onConflictDoUpdate({ target: [schema.messageTemplates.organizationId, schema.messageTemplates.key, schema.messageTemplates.channel], set: { subject, body, enabled, updatedAt: new Date() } });
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "template.updated", entity: "message_template", data: { key } });
  revalidatePath("/painel/notificacoes");
  return { ok: "Modelo salvo." };
}
