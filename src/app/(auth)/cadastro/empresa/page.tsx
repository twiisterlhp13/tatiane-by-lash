import { redirect } from "next/navigation";
import { getCtx, getSessionUser } from "@/lib/auth";
import { SEGMENTS } from "@/lib/org-setup";
import { AuthShell } from "../../auth-shell";
import { OrgForm } from "../../forms";

export const metadata = { title: "Seu negócio" };

export default async function Page() {
  if (await getCtx()) redirect("/painel");
  const user = await getSessionUser();
  if (!user) redirect("/cadastro");
  return (
    <AuthShell title={`Olá, ${user.name.split(" ")[0]}!`} subtitle="Passo 2 de 2 · Conte sobre o seu negócio">
      <OrgForm segments={SEGMENTS} />
    </AuthShell>
  );
}
