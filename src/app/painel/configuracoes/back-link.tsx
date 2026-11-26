import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackLink({ href = "/painel/configuracoes", label = "Configurações" }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
      <ChevronLeft size={16} /> {label}
    </Link>
  );
}
