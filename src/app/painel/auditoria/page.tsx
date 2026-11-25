import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth";
import { fmtDate } from "@/lib/time";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Auditoria" };

const LABELS: Record<string, string> = {
  "organization.created": "Criou o negócio",
  "organization.profile_updated": "Alterou dados do negócio",
  "organization.booking_settings_updated": "Alterou regras de agendamento",
  "organization.notification_settings_updated": "Alterou preferências de notificação",
  "user.login": "Entrou no painel",
  "user.signup": "Criou conta",
  "user.password_reset": "Redefiniu a senha",
  "appointment.created": "Criou agendamento",
  "appointment.rescheduled": "Reagendou",
  "appointment.confirmed": "Confirmou agendamento",
  "appointment.completed": "Concluiu atendimento",
  "appointment.cancelled_by_business": "Cancelou agendamento",
  "appointment.no_show": "Marcou falta",
  "appointment.pending": "Voltou agendamento para pendente",
  "block.created": "Bloqueou horário",
  "block.deleted": "Reabriu horário",
  "client.created": "Cadastrou cliente",
  "client.updated": "Editou cliente",
  "client.exported": "Exportou dados de cliente (LGPD)",
  "client.anonymized": "Excluiu dados de cliente (LGPD)",
  "service.created": "Criou serviço",
  "service.updated": "Editou serviço",
  "service.deleted": "Removeu serviço",
  "service.deactivated": "Desativou serviço",
  "professional.created": "Adicionou profissional",
  "professional.updated": "Editou profissional",
  "hours.updated": "Alterou horários",
  "special_hours.created": "Criou horário especial",
  "member.invited": "Convidou pessoa para o painel",
  "member.joined": "Aceitou convite",
  "member.updated": "Alterou acesso de membro",
  "template.updated": "Editou modelo de mensagem",
};

export default async function AuditPage() {
  const ctx = await requirePermission("audit.view");
  const rows = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.organizationId, ctx.org.id)).orderBy(desc(schema.auditLogs.createdAt)).limit(200);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Auditoria" subtitle="Registro das ações importantes feitas no painel (últimas 200)." />
      <Card className="divide-y divide-line">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-sm">
            <span><span className="font-medium">{r.actorLabel || "Sistema"}</span> · {LABELS[r.action] ?? r.action}</span>
            <span className="text-xs text-muted">{fmtDate(r.createdAt, ctx.org.timezone, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
