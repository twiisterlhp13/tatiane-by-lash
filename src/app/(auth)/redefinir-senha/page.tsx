import { AuthShell } from "../auth-shell";
import { ResetForm } from "../forms";

export const metadata = { title: "Nova senha" };

export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <AuthShell title="Criar nova senha">
      <ResetForm token={t ?? ""} />
    </AuthShell>
  );
}
