"use client";

import { useActionState } from "react";
import { Alert, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { Submit } from "@/components/submit";
import type { FormState } from "./actions";

type Values = { name: string; phone: string; email: string; birthDate: string; notes: string; marketingConsent: boolean };

export function ClientForm({ action, values, submitLabel, readOnly }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  values?: Partial<Values>;
  submitLabel: string;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <Alert>{state?.error}</Alert>
      <Alert tone="ok">{state?.ok}</Alert>
      <fieldset disabled={readOnly} className="space-y-4">
        <Field label="Nome"><Input name="name" required defaultValue={values?.name} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="WhatsApp / telefone"><Input name="phone" type="tel" inputMode="tel" required defaultValue={values?.phone} /></Field>
          <Field label="E-mail"><Input name="email" type="email" defaultValue={values?.email} /></Field>
        </div>
        <Field label="Data de nascimento" className="sm:max-w-[50%]"><Input name="birthDate" type="date" defaultValue={values?.birthDate} /></Field>
        <Field label="Observações e preferências" hint="Ex.: curvatura preferida, sensibilidade, alergias informadas. Evite dados de saúde desnecessários.">
          <Textarea name="notes" rows={3} defaultValue={values?.notes} />
        </Field>
        <Checkbox name="marketingConsent" defaultChecked={values?.marketingConsent} label="A cliente autorizou receber promoções e novidades (consentimento separado do agendamento)." />
      </fieldset>
      {!readOnly && <Submit>{submitLabel}</Submit>}
    </form>
  );
}
