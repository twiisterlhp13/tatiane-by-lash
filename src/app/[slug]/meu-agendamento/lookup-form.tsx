"use client";

import { useActionState } from "react";
import { Alert, Field, Input } from "@/components/ui";
import { Submit } from "@/components/submit";
import { lookupAction } from "../agendamento/actions";

export function LookupForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(lookupAction.bind(null, slug), undefined);
  return (
    <form action={action} className="space-y-4">
      <Alert>{state?.error}</Alert>
      <Field label="Código do agendamento"><Input name="code" required autoCapitalize="characters" className="font-mono uppercase tracking-widest" maxLength={10} /></Field>
      <Field label="WhatsApp"><Input name="phone" type="tel" inputMode="tel" required /></Field>
      <Submit className="w-full" pendingText="Procurando…">Procurar</Submit>
      <p className="text-xs text-muted">Por segurança, ao encontrar o agendamento geramos um novo link e o anterior deixa de funcionar.</p>
    </form>
  );
}
