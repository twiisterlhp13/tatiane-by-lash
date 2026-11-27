"use server";

import { revalidatePath } from "next/cache";
import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireCtx, requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { deleteServiceAction, saveServiceAction } from "../servicos/actions";
import { saveWeeklyHoursAction } from "../horarios/actions";

export type R = { ok: true } | { ok: false; error: string };

const JPEG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const perfilSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome que aparece na vitrine.").max(80),
  instagram: z.string().trim().max(60),
  area: z.string().trim().max(120),
  bio: z.string().trim().max(1200),
  whatsapp: z.string().trim().max(30),
  specialties: z.array(z.string().trim().min(1).max(40)).max(20),
  photo: z.union([z.string().max(400_000).regex(JPEG, "Imagem inválida."), z.null()]).optional(),
});

export async function salvarPerfilAction(input: z.input<typeof perfilSchema>): Promise<R> {
  const ctx = await requirePermission("settings.manage");
  const p = perfilSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const d = p.data;
  await db.update(schema.organizations).set({
    name: d.name,
    instagram: d.instagram.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, ""),
    area: d.area,
    description: d.bio,
    whatsapp: d.whatsapp,
    specialties: d.specialties,
    ...(d.photo !== undefined ? { logoUrl: d.photo } : {}),
    updatedAt: new Date(),
  }).where(eq(schema.organizations.id, ctx.org.id));
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "organization.profile_updated", entity: "organization", entityId: ctx.org.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

/* Horário simples: dias + início/fim + pausa opcional ------------------------ */

const horarioSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Escolha pelo menos um dia de atendimento."),
  ini: z.string().regex(/^\d{2}:\d{2}$/),
  fim: z.string().regex(/^\d{2}:\d{2}$/),
  pausaIni: z.string().default(""),
  pausaFim: z.string().default(""),
});

export async function salvarHorarioAction(input: z.input<typeof horarioSchema>): Promise<R> {
  const ctx = await requireCtx();
  const p = horarioSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const d = p.data;
  if (d.fim <= d.ini) return { ok: false, error: "O fim do expediente precisa ser depois do início." };
  const temPausa = !!(d.pausaIni && d.pausaFim);
  if (temPausa && !(d.pausaIni > d.ini && d.pausaFim < d.fim && d.pausaFim > d.pausaIni)) {
    return { ok: false, error: "A pausa precisa ficar dentro do expediente." };
  }
  let professionalId = ctx.professionalId;
  if (!professionalId) {
    const [first] = await db.select({ id: schema.professionals.id }).from(schema.professionals)
      .where(eq(schema.professionals.organizationId, ctx.org.id)).orderBy(asc(schema.professionals.sortOrder)).limit(1);
    professionalId = first?.id ?? null;
  }
  if (!professionalId) return { ok: false, error: "Cadastre uma profissional primeiro." };
  const intervals = temPausa ? [{ start: d.ini, end: d.pausaIni }, { start: d.pausaFim, end: d.fim }] : [{ start: d.ini, end: d.fim }];
  const r = await saveWeeklyHoursAction({
    professionalId,
    days: d.weekdays.map((weekday) => ({ weekday, intervals })),
    alsoBusinessHours: true,
    applyToAll: false,
  });
  revalidatePath("/painel/vitrine");
  revalidatePath("/", "layout");
  return r;
}

/* Procedimentos ------------------------------------------------------------ */

const servicoSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Informe o nome do procedimento.").max(120),
  price: z.number({ error: "Informe o valor." }).min(0).max(100000),
  minutes: z.number().int().min(5, "Duração mínima de 5 minutos.").max(720),
  description: z.string().trim().max(1000).default(""),
  priceFrom: z.boolean().default(false),
  onlineVisible: z.boolean().default(true),
});

export async function salvarServicoAction(input: z.input<typeof servicoSchema>): Promise<R> {
  const ctx = await requirePermission("services.manage");
  const p = servicoSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const d = p.data;
  let existing: typeof schema.services.$inferSelect | undefined;
  let pros: string[] = [];
  if (d.id) {
    [existing] = await db.select().from(schema.services).where(and(eq(schema.services.id, d.id), eq(schema.services.organizationId, ctx.org.id))).limit(1);
    if (!existing) return { ok: false, error: "Procedimento não encontrado." };
    pros = (await db.select().from(schema.professionalServices).where(eq(schema.professionalServices.serviceId, d.id))).map((l) => l.professionalId);
  }
  if (!pros.length) {
    pros = ctx.professionalId
      ? [ctx.professionalId]
      : (await db.select({ id: schema.professionals.id }).from(schema.professionals).where(and(eq(schema.professionals.organizationId, ctx.org.id), eq(schema.professionals.active, true)))).map((x) => x.id);
  }
  if (!pros.length) return { ok: false, error: "Cadastre uma profissional primeiro." };
  return saveServiceAction({
    id: d.id,
    name: d.name,
    category: existing?.category ?? "",
    description: d.description,
    durationMinutes: d.minutes,
    bufferMinutes: existing?.bufferMinutes ?? 10,
    priceCents: Math.round(d.price * 100),
    priceFrom: d.priceFrom,
    active: true,
    onlineVisible: d.onlineVisible,
    professionalIds: pros,
  }).then((r) => {
    revalidatePath("/painel/vitrine");
    return r;
  });
}

export async function apagarServicoAction(id: string): Promise<R> {
  const r = await deleteServiceAction(id);
  revalidatePath("/painel/vitrine");
  return r;
}

/* Portfólio ------------------------------------------------------------------ */

const MAX_FOTOS = 30;

export async function addFotoAction(dataUrl: string, caption = ""): Promise<R> {
  const ctx = await requirePermission("settings.manage");
  if (typeof dataUrl !== "string" || dataUrl.length > 900_000 || !JPEG.test(dataUrl)) {
    return { ok: false, error: "Imagem inválida ou grande demais." };
  }
  const [{ n }] = await db.select({ n: count() }).from(schema.portfolioPhotos).where(eq(schema.portfolioPhotos.organizationId, ctx.org.id));
  if (n >= MAX_FOTOS) return { ok: false, error: `O portfólio aceita até ${MAX_FOTOS} fotos. Apague alguma para enviar outra.` };
  await db.insert(schema.portfolioPhotos).values({ organizationId: ctx.org.id, imageData: dataUrl, caption: caption.slice(0, 140), sortOrder: n });
  revalidatePath("/painel/vitrine");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function apagarFotoAction(id: string): Promise<R> {
  const ctx = await requirePermission("settings.manage");
  const del = await db.delete(schema.portfolioPhotos)
    .where(and(eq(schema.portfolioPhotos.id, id), eq(schema.portfolioPhotos.organizationId, ctx.org.id)))
    .returning({ id: schema.portfolioPhotos.id });
  if (!del.length) return { ok: false, error: "Foto não encontrada." };
  revalidatePath("/painel/vitrine");
  revalidatePath("/", "layout");
  return { ok: true };
}
