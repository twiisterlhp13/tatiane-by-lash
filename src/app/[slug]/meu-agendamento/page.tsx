import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getOrgBySlug } from "@/lib/booking";
import { LookupForm } from "./lookup-form";

export const metadata = { title: "Encontrar meu agendamento", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();
  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <Link href={`/${org.slug}`} className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> {org.name}</Link>
      <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-soft)]">
        <h1 className="font-display text-2xl">Encontrar meu agendamento</h1>
        <p className="mt-1 text-sm text-muted">Informe o código que apareceu na confirmação e o WhatsApp usado no agendamento.</p>
        <div className="mt-6"><LookupForm slug={org.slug} /></div>
      </div>
    </main>
  );
}
