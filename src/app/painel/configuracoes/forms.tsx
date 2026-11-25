"use client";

import { useActionState, type ReactNode } from "react";
import { Alert } from "@/components/ui";
import { Submit } from "@/components/submit";
import type { FormState } from "./actions";

/** Formulário genérico com mensagens de sucesso/erro. */
export function SettingsForm({ action, children, submitLabel = "Salvar" }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  children: ReactNode;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <Alert>{state?.error}</Alert>
      <Alert tone="ok">{state?.ok}</Alert>
      {children}
      <Submit>{submitLabel}</Submit>
    </form>
  );
}
