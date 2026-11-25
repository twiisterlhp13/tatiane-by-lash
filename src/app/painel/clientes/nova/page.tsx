import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";

export const metadata = { title: "Nova cliente" };

export default async function Page() {
  await requirePermission("clients.manage");
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/painel/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Clientes</Link>
      <PageHeader title="Nova cliente" />
      <Card className="p-5 sm:p-7"><ClientForm action={createClientAction} submitLabel="Cadastrar cliente" /></Card>
    </div>
  );
}
