"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession, getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/security";

export type FormState = { error?: string } | undefined;

export async function acceptInviteAction(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("t") ?? "");
  const [inv] = await db.select().from(schema.invitations)
    .where(and(eq(schema.invitations.id, sha256(token)), isNull(schema.invitations.acceptedAt), gt(schema.invitations.expiresAt, new Date()))).limit(1);
  if (!inv) return { error: "Convite inválido ou expirado. Peça um novo." };

  let userId: string;
  let userName: string;
  const current = await getSessionUser();
  if (current && current.email === inv.email) {
    userId = current.id;
    userName = current.name;
  } else {
    const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, inv.email)).limit(1);
    const password = String(form.get("password") ?? "");
    if (existing) {
      if (!(await verifyPassword(password, existing.passwordHash))) return { error: "Senha incorreta para esta conta." };
      userId = existing.id;
      userName = existing.name;
    } else {
      const name = String(form.get("name") ?? "").trim();
      if (name.length < 2) return { error: "Informe seu nome." };
      if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
      if (form.get("terms") !== "on") return { error: "É preciso aceitar os termos e a política de privacidade." };
      const [u] = await db.insert(schema.users).values({ name, email: inv.email, passwordHash: await hashPassword(password), termsAcceptedAt: new Date() }).returning();
      userId = u.id;
      userName = u.name;
    }
  }
  await db.insert(schema.organizationMembers)
    .values({ organizationId: inv.organizationId, userId, role: inv.role, professionalId: inv.professionalId })
    .onConflictDoUpdate({ target: [schema.organizationMembers.organizationId, schema.organizationMembers.userId], set: { role: inv.role, professionalId: inv.professionalId, active: true } });
  await db.update(schema.invitations).set({ acceptedAt: new Date() }).where(eq(schema.invitations.id, inv.id));
  await audit({ organizationId: inv.organizationId, userId, actorLabel: userName, action: "member.joined", entity: "member", data: { role: inv.role } });
  await createSession(userId, inv.organizationId);
  redirect("/painel");
}
