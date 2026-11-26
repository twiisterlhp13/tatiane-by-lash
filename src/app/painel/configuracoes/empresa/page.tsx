import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { appUrl } from "@/lib/notify";
import { Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { SettingsForm } from "../forms";
import { BackLink } from "../back-link";
import { saveProfileAction } from "../actions";

export const metadata = { title: "Perfil da empresa" };

export default async function CompanyPage() {
  const ctx = await requirePermission("settings.manage");
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, ctx.org.id));
  return (
    <div className="mx-auto max-w-3xl">
      <BackLink />
      <PageHeader title="Perfil da empresa" subtitle="Dados que aparecem para as clientes na sua página." />

      <Card className="p-5 sm:p-7">
        <h2 className="mb-1 font-display text-xl">Negócio e página pública</h2>
        <p className="mb-5 text-sm text-muted">Essas informações aparecem para as clientes em {appUrl()}/{org.slug}</p>
        <SettingsForm action={saveProfileAction}>
          <Field label="Nome do negócio"><Input name="name" defaultValue={org.name} required /></Field>
          <Field label="Link da página" hint={`${appUrl()}/seu-link · use letras, números e hífen.`}>
            <Input name="slug" defaultValue={org.slug} required pattern="[a-zA-Z0-9\-]{3,48}" />
          </Field>
          <Field label="Descrição" hint="Conte em poucas linhas sobre o seu trabalho.">
            <Textarea name="description" rows={3} defaultValue={org.description} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefone"><Input name="phone" type="tel" defaultValue={org.phone} /></Field>
            <Field label="WhatsApp" hint="Botão de contato na página."><Input name="whatsapp" type="tel" defaultValue={org.whatsapp} /></Field>
            <Field label="E-mail de contato"><Input name="email" type="email" defaultValue={org.email} /></Field>
            <Field label="Instagram"><Input name="instagram" defaultValue={org.instagram} placeholder="@seuperfil" /></Field>
          </div>
          <Field label="Endereço"><Input name="address" defaultValue={org.address} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Logo (link da imagem)" hint="Opcional. Quadrada, de preferência."><Input name="logoUrl" type="url" defaultValue={org.logoUrl ?? ""} /></Field>
            <Field label="Imagem de capa (link)" hint="Opcional."><Input name="coverUrl" type="url" defaultValue={org.coverUrl ?? ""} /></Field>
          </div>
        </SettingsForm>
      </Card>

    </div>
  );
}
