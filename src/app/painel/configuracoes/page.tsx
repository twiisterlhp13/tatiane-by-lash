import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { orgSettings } from "@/lib/booking";
import { appUrl } from "@/lib/notify";
import { Card, Checkbox, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { SettingsForm } from "./forms";
import { saveBookingSettingsAction, saveProfileAction } from "./actions";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const ctx = await requirePermission("settings.manage");
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, ctx.org.id));
  const s = orgSettings(org);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Configurações" subtitle="Dados do negócio, página pública e regras de agendamento." />

      <Card className="mb-6 p-5 sm:p-7">
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

      <Card className="p-5 sm:p-7">
        <h2 className="mb-5 font-display text-xl">Agendamento online e políticas</h2>
        <SettingsForm action={saveBookingSettingsAction}>
          <div className="rounded-xl bg-berry-soft/60 p-4">
            <Checkbox name="onlineBookingEnabled" defaultChecked={org.onlineBookingEnabled} label={<><strong>Agendamento online ativo.</strong> Desligado, a página mostra seus serviços e contato, mas só você cria agendamentos (agenda interna).</>} />
          </div>
          <Checkbox name="autoConfirmOnline" defaultChecked={s.autoConfirmOnline} label="Confirmar automaticamente os agendamentos feitos pelo site (desmarque para aprovar um por um)" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Horários a cada">
              <Select name="slotIntervalMinutes" defaultValue={String(s.slotIntervalMinutes)}>
                {[10, 15, 20, 30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n} min</option>)}
              </Select>
            </Field>
            <Field label="Antecedência mínima" hint="Em horas."><Input name="minAdvanceHours" type="number" min={0} max={720} defaultValue={Math.round(s.minAdvanceMinutes / 60)} /></Field>
            <Field label="Agenda aberta por" hint="Dias à frente."><Input name="maxAdvanceDays" type="number" min={1} max={365} defaultValue={s.maxAdvanceDays} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente pode cancelar até" hint="Horas antes. 0 = só pelo WhatsApp."><Input name="cancelUntilHours" type="number" min={0} max={720} defaultValue={s.cancelUntilHours} /></Field>
            <Field label="Cliente pode reagendar até" hint="Horas antes. 0 = só pelo WhatsApp."><Input name="rescheduleUntilHours" type="number" min={0} max={720} defaultValue={s.rescheduleUntilHours} /></Field>
          </div>
          <Checkbox name="requireCancelReason" defaultChecked={s.requireCancelReason} label="Pedir o motivo quando a cliente cancelar" />
          <Checkbox name="requireEmail" defaultChecked={s.requireEmail} label="Exigir e-mail no agendamento online (sem e-mail a cliente não recebe confirmação nem lembrete)" />
          <Field label="Texto da política" hint="Mostrado antes da confirmação e no link do agendamento.">
            <Textarea name="policyText" rows={4} defaultValue={s.policyText} />
          </Field>
        </SettingsForm>
      </Card>
    </div>
  );
}
