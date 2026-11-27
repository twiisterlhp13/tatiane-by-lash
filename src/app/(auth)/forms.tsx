"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Checkbox, Field, Input, Select } from "@/components/ui";
import { Submit } from "@/components/submit";
import { createOrgAction, loginAction, requestResetAction, resetPasswordAction, signupAction } from "./actions";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {notice && <Alert tone="ok">{notice}</Alert>}
      <Alert>{state?.error}</Alert>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} />
      </Field>
      <Field label="Senha">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Submit className="w-full" pendingText="Entrando…">Entrar</Submit>
      <p className="text-center text-sm">
        <Link href="/recuperar-senha" className="font-semibold text-ink underline-offset-4 hover:underline">Esqueci minha senha</Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signupAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Alert>{state?.error}</Alert>
      <Field label="Seu nome">
        <Input name="name" autoComplete="name" required defaultValue={state?.fields?.name} />
      </Field>
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} />
      </Field>
      <Field label="Senha" hint="Mínimo de 8 caracteres.">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Checkbox
        name="terms"
        required
        label={
          <>
            Li e aceito os <Link href="/termos" target="_blank" className="text-berry underline">termos de uso</Link> e a{" "}
            <Link href="/privacidade" target="_blank" className="text-berry underline">política de privacidade</Link>.
          </>
        }
      />
      <Submit className="w-full" pendingText="Criando conta…">Criar conta</Submit>
    </form>
  );
}

export function OrgForm({ segments }: { segments: { value: string; label: string }[] }) {
  const [state, action] = useActionState(createOrgAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Alert>{state?.error}</Alert>
      <Field label="Nome do negócio">
        <Input name="name" required placeholder="Ex.: Tatiane By Lash" />
      </Field>
      <Field label="Segmento">
        <Select name="segment" defaultValue="lash">
          {segments.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
      </Field>
      <Field label="WhatsApp / telefone">
        <Input name="phone" type="tel" inputMode="tel" placeholder="(11) 99999-9999" />
      </Field>
      <Field label="Endereço" hint="Aparece para a cliente na confirmação. Pode deixar em branco.">
        <Input name="address" placeholder="Rua, número, bairro, cidade" />
      </Field>
      <Checkbox name="suggested" defaultChecked label="Já cadastrar serviços sugeridos para o meu segmento (você edita preços e durações depois)." />
      <Submit className="w-full" pendingText="Criando…">Criar minha agenda</Submit>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestResetAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Alert>{state?.error}</Alert>
      <Alert tone="ok">{state?.ok}</Alert>
      <Field label="E-mail da conta">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Submit className="w-full" pendingText="Enviando…">Enviar link</Submit>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Alert>{state?.error}</Alert>
      <input type="hidden" name="t" value={token} />
      <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Submit className="w-full">Salvar nova senha</Submit>
    </form>
  );
}
