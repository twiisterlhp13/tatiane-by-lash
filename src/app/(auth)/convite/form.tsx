"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Checkbox, Field, Input } from "@/components/ui";
import { Submit } from "@/components/submit";
import { acceptInviteAction } from "./actions";

export function InviteForm({ token, email, mode }: { token: string; email: string; mode: "new" | "existing" | "logged" }) {
  const [state, action] = useActionState(acceptInviteAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Alert>{state?.error}</Alert>
      <input type="hidden" name="t" value={token} />
      <Field label="E-mail"><Input value={email} disabled /></Field>
      {mode === "new" && <Field label="Seu nome"><Input name="name" required autoComplete="name" /></Field>}
      {mode !== "logged" && (
        <Field label={mode === "new" ? "Crie uma senha" : "Sua senha"}>
          <Input name="password" type="password" minLength={8} required autoComplete={mode === "new" ? "new-password" : "current-password"} />
        </Field>
      )}
      {mode === "new" && (
        <Checkbox name="terms" required label={<>Aceito os <Link href="/termos" className="text-berry underline">termos</Link> e a <Link href="/privacidade" className="text-berry underline">política de privacidade</Link>.</>} />
      )}
      <Submit className="w-full">Aceitar convite</Submit>
    </form>
  );
}
