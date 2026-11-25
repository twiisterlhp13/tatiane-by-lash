import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { randomToken, sha256 } from "./security";
import { can, type Permission, type Role } from "./permissions";
import { defaultOrgSettings, type OrgSettings } from "@/db/schema";

const COOKIE = "tbl_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 11);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, organizationId: string | null) {
  const token = randomToken();
  const ua = (await headers()).get("user-agent")?.slice(0, 250) ?? "";
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.insert(schema.sessions).values({ id: sha256(token), userId, organizationId, expiresAt, userAgent: ua });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  jar.delete(COOKIE);
}

export type Ctx = {
  sessionId: string;
  user: { id: string; name: string; email: string };
  org: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    onlineBookingEnabled: boolean;
    settings: OrgSettings;
    logoUrl: string | null;
  };
  role: Role;
  /** Profissional vinculado a esta usuária (se houver). */
  professionalId: string | null;
  can: (p: Permission) => boolean;
};

/** Lê a sessão atual. Retorna null se não houver sessão válida. */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const id = sha256(token);
  const [row] = await db
    .select({
      sessionId: schema.sessions.id,
      orgId: schema.sessions.organizationId,
      userId: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;

  // Membro ativo da organização da sessão (ou a primeira organização disponível)
  const memberships = await db
    .select({
      role: schema.organizationMembers.role,
      professionalId: schema.organizationMembers.professionalId,
      org: schema.organizations,
    })
    .from(schema.organizationMembers)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.organizationMembers.organizationId))
    .where(and(eq(schema.organizationMembers.userId, row.userId), eq(schema.organizationMembers.active, true)));
  if (memberships.length === 0) return null;
  const m = memberships.find((x) => x.org.id === row.orgId) ?? memberships[0];
  const role = m.role as Role;
  return {
    sessionId: row.sessionId,
    user: { id: row.userId, name: row.name, email: row.email },
    org: {
      id: m.org.id,
      name: m.org.name,
      slug: m.org.slug,
      timezone: m.org.timezone,
      onlineBookingEnabled: m.org.onlineBookingEnabled,
      settings: { ...defaultOrgSettings, ...m.org.settings },
      logoUrl: m.org.logoUrl,
    },
    role,
    professionalId: m.professionalId,
    can: (p: Permission) => can(role, p),
  };
});

/** Exige sessão; redireciona para o login caso não exista. */
export async function requireCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) {
    // pode existir usuária logada sem empresa (cadastro interrompido)
    const token = (await cookies()).get(COOKIE)?.value;
    if (token) {
      const [s] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sha256(token))).limit(1);
      if (s && s.expiresAt > new Date()) redirect("/cadastro/empresa");
    }
    redirect("/entrar");
  }
  return ctx;
}

export class ForbiddenError extends Error {
  constructor(message = "Você não tem permissão para esta ação.") {
    super(message);
  }
}

export async function requirePermission(p: Permission): Promise<Ctx> {
  const ctx = await requireCtx();
  if (!ctx.can(p)) throw new ForbiddenError();
  return ctx;
}

/** Usuária autenticada sem exigir empresa (usado no passo de criação da empresa). */
export async function getSessionUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, sessionId: schema.sessions.id })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64);
}
