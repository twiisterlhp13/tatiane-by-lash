import Link from "next/link";
import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { AuthShell } from "../auth-shell";
import { SignupForm } from "../forms";

export const metadata = { title: "Criar conta" };

export default async function Page() {
  if (await getCtx()) redirect("/painel");
  return (
    <AuthShell
      title="Crie sua agenda"
      subtitle="Passo 1 de 2 · Sua conta de acesso"
      footer={<>Já tem conta? <Link href="/entrar" className="text-berry underline-offset-4 hover:underline">Entrar</Link></>}
    >
      <SignupForm />
    </AuthShell>
  );
}
