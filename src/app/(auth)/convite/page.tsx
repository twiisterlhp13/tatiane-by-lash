import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { sha256 } from "@/lib/security";
import { ROLE_LABEL } from "@/lib/permissions";
import { AuthShell } from "../auth-shell";
import { InviteForm } from "./form";

export const metadata = { title: "Convite" };

export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  const [row] = await db.select({ inv: schema.invitations, org: schema.organizations.name })
    .from(schema.invitations).innerJoin(schema.organizations, eq(schema.organizations.id, schema.invitations.organizationId))
    .where(and(eq(schema.invitations.id, sha256(t)), isNull(schema.invitations.acceptedAt), gt(schema.invitations.expiresAt, new Date()))).limit(1);
  if (!row) return <AuthShell title="Convite inválido" subtitle="Este convite expirou ou já foi usado. Peça um novo para quem te convidou." >{null}</AuthShell>;
  const current = await getSessionUser();
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, row.inv.email)).limit(1);
  const mode = current?.email === row.inv.email ? "logged" : existing ? "existing" : "new";
  return (
    <AuthShell title={`Agenda de ${row.org}`} subtitle={`Você foi convidada como ${ROLE_LABEL[row.inv.role].toLowerCase()}.`}>
      <InviteForm token={t} email={row.inv.email} mode={mode} />
    </AuthShell>
  );
}
