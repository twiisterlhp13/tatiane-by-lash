"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { clientIp, createSession, destroySession, getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createOrganization } from "@/lib/org-setup";
import { randomToken, sha256 } from "@/lib/security";
import { appUrl } from "@/lib/notify";

function isRedirect(e: unknown) {
  return typeof (e as { digest?: unknown })?.digest === "string" && (e as { digest: string }).digest.startsWith("NEXT_REDIRECT");
}

export type FormState = { error?: string; ok?: string; fields?: Record<string, string> } | undefined;

const signupSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.email("E-mail inválido.").trim().toLowerCase(),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  terms: z.literal("on", { error: "É preciso aceitar os termos e a política de privacidade." }),
});

export async function signupAction(state: FormState, form: FormData): Promise<FormState> {
  try {
    return await signupInner(state, form);
  } catch (e) {
    if (isRedirect(e)) throw e;
    console.error("[signup] falhou", e);
    return { error: "Não foi possível criar a conta agora. Tente de novo em instantes." };
  }
}

async function signupInner(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  const fields = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const { name, email, password } = parsed.data;
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (exists) return { error: "Já existe uma conta com este e-mail. Faça login.", fields };
  const [user] = await db.insert(schema.users).values({
    name, email, passwordHash: await hashPassword(password), termsAcceptedAt: new Date(),
  }).returning();
  await audit({ organizationId: null, userId: user.id, actorLabel: name, action: "user.signup", entity: "user", entityId: user.id, ip: await clientIp() });
  await createSession(user.id, null);
  redirect("/cadastro/empresa");
}

const orgSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do negócio."),
  segment: z.string().min(1),
  phone: z.string().trim().max(30).default(""),
  address: z.string().trim().max(200).default(""),
  suggested: z.string().optional(),
});

export async function createOrgAction(state: FormState, form: FormData): Promise<FormState> {
  try {
    return await createOrgInner(state, form);
  } catch (e) {
    if (isRedirect(e)) throw e;
    console.error("[create-org] falhou", e);
    return { error: "Não foi possível criar o negócio agora. Tente de novo em instantes." };
  }
}

async function createOrgInner(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  const parsed = orgSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const org = await createOrganization({
    ownerUserId: user.id,
    ownerName: user.name,
    ownerEmail: user.email,
    name: parsed.data.name,
    segment: parsed.data.segment,
    phone: parsed.data.phone,
    address: parsed.data.address,
    withSuggestedServices: parsed.data.suggested === "on",
  });
  await db.update(schema.sessions).set({ organizationId: org.id }).where(eq(schema.sessions.id, user.sessionId));
  redirect("/painel?bem-vinda=1");
}

const MAX_FAILS = 5;

export async function loginAction(state: FormState, form: FormData): Promise<FormState> {
  try {
    return await loginInner(state, form);
  } catch (e) {
    if (isRedirect(e)) throw e;
    console.error("[login] falhou", e);
    return { error: "Não foi possível entrar agora. Tente de novo em instantes." };
  }
}

async function loginInner(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  const fields = { email };
  if (!email || !password) return { error: "Informe e-mail e senha.", fields };
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const generic = "E-mail ou senha incorretos.";
  if (!user) {
    await verifyPassword(password, "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv"); // tempo constante
    return { error: generic, fields };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "Muitas tentativas. Tente novamente em alguns minutos ou redefina sua senha.", fields };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const fails = user.failedLogins + 1;
    await db.update(schema.users).set({
      failedLogins: fails,
      lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + 15 * 60000) : null,
    }).where(eq(schema.users.id, user.id));
    return { error: generic, fields };
  }
  await db.update(schema.users).set({ failedLogins: 0, lockedUntil: null }).where(eq(schema.users.id, user.id));
  const [member] = await db.select().from(schema.organizationMembers)
    .where(and(eq(schema.organizationMembers.userId, user.id), eq(schema.organizationMembers.active, true))).limit(1);
  await createSession(user.id, member?.organizationId ?? null);
  await audit({ organizationId: member?.organizationId ?? null, userId: user.id, actorLabel: user.name, action: "user.login", entity: "user", entityId: user.id, ip: await clientIp() });
  if (!member) redirect("/cadastro/empresa");
  redirect(next.startsWith("/painel") ? next : "/painel");
}

export async function logoutAction() {
  await destroySession();
  redirect("/entrar");
}

export async function requestResetAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const ok = "Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha.";
  if (!email) return { error: "Informe seu e-mail." };
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!user) return { ok };
  const token = randomToken();
  await db.insert(schema.passwordResets).values({ id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 3600000) });
  const link = `${appUrl()}/redefinir-senha?t=${token}`;
  const key = process.env.RESEND_API_KEY;
  if (key) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Agenda <onboarding@resend.dev>",
        to: [user.email],
        subject: "Redefinir sua senha",
        text: `Olá, ${user.name}!\n\nPara criar uma nova senha, acesse (válido por 1 hora):\n${link}\n\nSe não foi você, ignore este e-mail.`,
      }),
    }).catch(() => null);
  } else {
    console.log(`[reset-senha] Provedor de e-mail não configurado. Link para ${user.email}: ${link}`);
  }
  return { ok };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("t") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  const [reset] = await db.select().from(schema.passwordResets)
    .where(and(eq(schema.passwordResets.id, sha256(token)), gt(schema.passwordResets.expiresAt, new Date()), isNull(schema.passwordResets.usedAt))).limit(1);
  if (!reset) return { error: "Link inválido ou expirado. Peça um novo." };
  await db.update(schema.users).set({ passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null }).where(eq(schema.users.id, reset.userId));
  await db.update(schema.passwordResets).set({ usedAt: new Date() }).where(eq(schema.passwordResets.id, reset.id));
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, reset.userId));
  await audit({ organizationId: null, userId: reset.userId, action: "user.password_reset", entity: "user", entityId: reset.userId, ip: await clientIp() });
  redirect("/entrar?senha=ok");
}
