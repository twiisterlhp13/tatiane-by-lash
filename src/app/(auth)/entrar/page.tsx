import Link from "next/link";
import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { AuthShell } from "../auth-shell";
import { LoginForm } from "../forms";

export const metadata = { title: "Entrar" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; senha?: string }> }) {
  if (await getCtx()) redirect("/painel");
  const sp = await searchParams;
  return (
    <AuthShell
      title="Entrar no painel"
      subtitle="Acesse sua agenda, clientes e serviços."
      footer={<>Ainda não tem conta? <Link href="/cadastro" className="text-berry underline-offset-4 hover:underline">Criar conta grátis</Link></>}
    >
      <LoginForm next={sp.next} notice={sp.senha === "ok" ? "Senha alterada. Entre com a nova senha." : undefined} />
    </AuthShell>
  );
}
