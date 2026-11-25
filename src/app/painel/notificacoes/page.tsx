import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { orgSettings } from "@/lib/booking";
import { DEFAULT_TEMPLATES, TEMPLATE_LABELS, type TemplateKey } from "@/lib/notify";
import { fmtDate } from "@/lib/time";
import { Alert, Badge, Card, Checkbox, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { SettingsForm } from "../configuracoes/forms";
import { saveNotificationSettingsAction, saveTemplateAction } from "../configuracoes/actions";

export const metadata = { title: "Notificações" };

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
  sent: { label: "Enviado", tone: "ok" },
  simulated: { label: "Simulado", tone: "warn" },
  failed: { label: "Falhou", tone: "danger" },
  skipped: { label: "Não enviado", tone: "neutral" },
  queued: { label: "Na fila", tone: "neutral" },
};

export default async function NotificationsPage() {
  const ctx = await requirePermission("settings.manage");
  const tz = ctx.org.timezone;
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, ctx.org.id));
  const s = orgSettings(org);
  const [log, custom] = await Promise.all([
    db.select().from(schema.notifications).where(eq(schema.notifications.organizationId, ctx.org.id)).orderBy(desc(schema.notifications.createdAt)).limit(60),
    db.select().from(schema.messageTemplates).where(eq(schema.messageTemplates.organizationId, ctx.org.id)),
  ]);
  const emailReady = !!process.env.RESEND_API_KEY;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notificações" subtitle="Confirmações e lembretes enviados às clientes e a você." />
      {!emailReady && (
        <div className="mb-6">
          <Alert tone="warn">
            O envio de e-mails ainda não está ligado. As mensagens são registradas abaixo como <strong>simuladas</strong> e nenhuma cliente recebe nada por enquanto.
            Para ativar, configure a chave do provedor de e-mail (Resend) no projeto.
          </Alert>
        </div>
      )}

      <Card className="mb-6 p-5 sm:p-7">
        <h2 className="mb-5 font-display text-xl">Preferências</h2>
        <SettingsForm action={saveNotificationSettingsAction}>
          <Field label="Receber aviso de novos agendamentos e cancelamentos no e-mail" hint="Deixe em branco para não receber.">
            <Input name="notifyBusinessEmail" type="email" defaultValue={s.notifyBusinessEmail} />
          </Field>
          <Checkbox name="reminder24h" defaultChecked={s.reminder24h} label="Enviar lembrete para a cliente na véspera" />
          <Checkbox name="reminder2h" defaultChecked={s.reminder2h} label="Enviar lembrete cerca de 2 horas antes" />
          <p className="text-xs text-muted">WhatsApp e SMS: o sistema já tem o ponto de integração pronto. Basta contratar um provedor para ativar.</p>
        </SettingsForm>
      </Card>

      <Card className="mb-6 p-5 sm:p-7">
        <h2 className="font-display text-xl">Modelos de mensagem</h2>
        <p className="mt-1 text-sm text-muted">
          Variáveis: {"{{cliente}} {{servico}} {{profissional}} {{data}} {{hora}} {{empresa}} {{endereco}} {{codigo}} {{link}}"}
        </p>
        <div className="mt-4 space-y-3">
          {(Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]).map((key) => {
            const c = custom.find((t) => t.key === key);
            const tpl = c ?? DEFAULT_TEMPLATES[key];
            return (
              <details key={key} className="rounded-xl border border-line px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {TEMPLATE_LABELS[key]} {c && <Badge tone="berry" className="ml-2">personalizado</Badge>} {c && !c.enabled && <Badge className="ml-1">desligado</Badge>}
                </summary>
                <div className="mt-4">
                  <SettingsForm action={saveTemplateAction} submitLabel="Salvar modelo">
                    <input type="hidden" name="key" value={key} />
                    <Field label="Assunto"><Input name="subject" defaultValue={tpl.subject} /></Field>
                    <Field label="Mensagem"><Textarea name="body" rows={8} defaultValue={tpl.body} /></Field>
                    <Checkbox name="enabled" defaultChecked={c ? c.enabled : true} label="Enviar esta mensagem" />
                    {c && <Checkbox name="reset" value="1" label="Restaurar o texto padrão" />}
                  </SettingsForm>
                </div>
              </details>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 sm:p-7">
        <h2 className="mb-4 font-display text-xl">Histórico de envios</h2>
        {log.length === 0 ? <p className="text-sm text-muted">Nenhuma mensagem ainda.</p> : (
          <ul className="divide-y divide-line text-sm">
            {log.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate">{n.subject || TEMPLATE_LABELS[n.templateKey as TemplateKey]}</span>
                  <span className="text-xs text-muted">{fmtDate(n.createdAt, tz, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {n.recipient || "—"}{n.error && ` · ${n.error}`}</span>
                </span>
                <Badge tone={STATUS[n.status]?.tone}>{STATUS[n.status]?.label ?? n.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
