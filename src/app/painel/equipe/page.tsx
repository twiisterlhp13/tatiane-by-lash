import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TeamManager } from "./team-manager";

export const metadata = { title: "Equipe" };

export default async function TeamPage() {
  const ctx = await requirePermission("team.manage");
  const [pros, members, invites] = await Promise.all([
    db.select().from(schema.professionals).where(eq(schema.professionals.organizationId, ctx.org.id)).orderBy(asc(schema.professionals.sortOrder), asc(schema.professionals.name)),
    db.select({ m: schema.organizationMembers, name: schema.users.name, email: schema.users.email })
      .from(schema.organizationMembers).innerJoin(schema.users, eq(schema.users.id, schema.organizationMembers.userId))
      .where(eq(schema.organizationMembers.organizationId, ctx.org.id)),
    db.select().from(schema.invitations).where(and(eq(schema.invitations.organizationId, ctx.org.id), isNull(schema.invitations.acceptedAt), gt(schema.invitations.expiresAt, new Date()))),
  ]);
  return (
    <>
      <PageHeader title="Equipe" subtitle="Profissionais que atendem e pessoas com acesso ao painel." />
      <TeamManager
        professionals={pros.map((p) => ({ id: p.id, name: p.name, bio: p.bio, email: p.email, color: p.color, active: p.active, acceptsOnline: p.acceptsOnline, photoUrl: p.photoUrl ?? "" }))}
        members={members.map(({ m, name, email }) => ({ id: m.id, name, email, role: m.role, professionalId: m.professionalId ?? "", active: m.active, isMe: m.userId === ctx.user.id }))}
        invites={invites.map((i) => ({ email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() }))}
      />
    </>
  );
}
