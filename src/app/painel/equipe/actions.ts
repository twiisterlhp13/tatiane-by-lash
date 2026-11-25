"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { appUrl } from "@/lib/notify";
import { randomToken, sha256 } from "@/lib/security";

export type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const proSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Informe o nome."),
  bio: z.string().trim().max(500),
  email: z.union([z.email(), z.literal("")]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  active: z.boolean(),
  acceptsOnline: z.boolean(),
  photoUrl: z.union([z.url(), z.literal("")]),
});

export async function saveProfessionalAction(input: z.input<typeof proSchema>): Promise<Result> {
  const ctx = await requirePermission("team.manage");
  const p = proSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { id, photoUrl, ...data } = p.data;
  if (id) {
    const [ex] = await db.select().from(schema.professionals).where(and(eq(schema.professionals.id, id), eq(schema.professionals.organizationId, ctx.org.id))).limit(1);
    if (!ex) return { ok: false, error: "Não encontrada." };
    if (!data.active) {
      const [{ n }] = await db.select({ n: count() }).from(schema.professionals)
        .where(and(eq(schema.professionals.organizationId, ctx.org.id), eq(schema.professionals.active, true), ne(schema.professionals.id, id)));
      if (n === 0) return { ok: false, error: "É preciso ter pelo menos uma profissional ativa." };
    }
    await db.update(schema.professionals).set({ ...data, photoUrl: photoUrl || null }).where(eq(schema.professionals.id, id));
  } else {
    const [created] = await db.insert(schema.professionals).values({ ...data, photoUrl: photoUrl || null, organizationId: ctx.org.id }).returning();
    // começa com o horário padrão da empresa e todos os serviços ativos
    const bh = await db.select().from(schema.businessHours).where(eq(schema.businessHours.organizationId, ctx.org.id));
    if (bh.length) await db.insert(schema.professionalHours).values(bh.map((h) => ({ organizationId: ctx.org.id, professionalId: created.id, weekday: h.weekday, startMinute: h.startMinute, endMinute: h.endMinute })));
    const svcs = await db.select({ id: schema.services.id }).from(schema.services).where(and(eq(schema.services.organizationId, ctx.org.id), eq(schema.services.active, true)));
    if (svcs.length) await db.insert(schema.professionalServices).values(svcs.map((s) => ({ organizationId: ctx.org.id, professionalId: created.id, serviceId: s.id })));
  }
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: id ? "professional.updated" : "professional.created", entity: "professional", entityId: id ?? null, data: { name: data.name, active: data.active } });
  revalidatePath("/painel/equipe");
  return { ok: true };
}

const inviteSchema = z.object({
  email: z.email("E-mail inválido.").trim().toLowerCase(),
  role: z.enum(["admin", "professional", "receptionist"]),
  professionalId: z.string(),
});

export async function inviteMemberAction(input: z.input<typeof inviteSchema>): Promise<Result<{ link: string }>> {
  const ctx = await requirePermission("team.manage");
  const p = inviteSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  if (p.data.role === "professional" && !p.data.professionalId) return { ok: false, error: "Escolha qual profissional da agenda é esta pessoa." };
  const token = randomToken();
  await db.insert(schema.invitations).values({
    id: sha256(token), organizationId: ctx.org.id, email: p.data.email, role: p.data.role,
    professionalId: p.data.professionalId || null, expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  const link = `${appUrl()}/convite?t=${token}`;
  const key = process.env.RESEND_API_KEY;
  if (key) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Agenda <onboarding@resend.dev>",
        to: [p.data.email],
        subject: `Convite para a agenda de ${ctx.org.name}`,
        text: `${ctx.user.name} convidou você para acessar a agenda de ${ctx.org.name}.\n\nAceite o convite (válido por 7 dias):\n${link}`,
      }),
    }).catch(() => null);
  }
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "member.invited", entity: "invitation", data: { email: p.data.email, role: p.data.role } });
  return { ok: true, data: { link } };
}

export async function updateMemberAction(input: { memberId: string; role: "admin" | "professional" | "receptionist"; professionalId: string; active: boolean }): Promise<Result> {
  const ctx = await requirePermission("team.manage");
  const [m] = await db.select().from(schema.organizationMembers)
    .where(and(eq(schema.organizationMembers.id, input.memberId), eq(schema.organizationMembers.organizationId, ctx.org.id))).limit(1);
  if (!m) return { ok: false, error: "Membro não encontrado." };
  if (m.role === "owner") return { ok: false, error: "O acesso da proprietária não pode ser alterado aqui." };
  await db.update(schema.organizationMembers).set({ role: input.role, professionalId: input.professionalId || null, active: input.active }).where(eq(schema.organizationMembers.id, m.id));
  if (!input.active) await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, m.userId), eq(schema.sessions.organizationId, ctx.org.id)));
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "member.updated", entity: "member", entityId: m.id, data: input });
  revalidatePath("/painel/equipe");
  return { ok: true };
}
