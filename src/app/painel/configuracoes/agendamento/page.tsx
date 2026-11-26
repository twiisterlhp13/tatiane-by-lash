import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { orgSettings } from "@/lib/booking";
import { Card, Checkbox, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { SettingsForm } from "../forms";
import { BackLink } from "../back-link";
import { saveBookingSettingsAction } from "../actions";

export const metadata = { title: "Agenda do cliente" };

export default async function BookingSettingsPage() {
  const ctx = await requirePermission("settings.manage");
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, ctx.org.id));
  const s = orgSettings(org);
  return (
    <div className="mx-auto max-w-3xl">
      <BackLink />
      <PageHeader title="Agenda do cliente" subtitle="Agendamento online, antecedência e políticas de cancelamento." />

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
