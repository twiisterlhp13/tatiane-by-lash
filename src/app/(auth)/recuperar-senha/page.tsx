import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { ResetRequestForm } from "../forms";

export const metadata = { title: "Recuperar senha" };

export default function Page() {
  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Enviaremos um link para você criar uma nova senha."
      footer={<Link href="/entrar" className="text-berry underline-offset-4 hover:underline">Voltar para o login</Link>}
    >
      <ResetRequestForm />
    </AuthShell>
  );
}
