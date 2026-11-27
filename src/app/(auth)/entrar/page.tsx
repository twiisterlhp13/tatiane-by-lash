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
      title="Entrar"
      subtitle="Acesse sua agenda, clientes e financeiro."
      footer={<>Ainda não tem conta? <Link href="/cadastro" className="font-semibold text-ink underline-offset-4 hover:underline">Criar conta</Link></>}
    >
      <LoginForm next={sp.next} notice={sp.senha === "ok" ? "Senha alterada. Entre com a nova senha." : undefined} />
    </AuthShell>
  );
}
