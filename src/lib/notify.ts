import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { fmtLongDate, fmtTime } from "./time";

/* ------------------------------------------------------------------ */
/* Templates padrão (editáveis por empresa na tabela message_templates)*/
/* ------------------------------------------------------------------ */

export type TemplateKey =
  | "booking_confirmed_client"
  | "booking_pending_client"
  | "booking_cancelled_client"
  | "booking_rescheduled_client"
  | "reminder_24h"
  | "reminder_2h"
  | "booking_new_business"
  | "booking_cancelled_business";

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  booking_confirmed_client: "Agendamento confirmado (para a cliente)",
  booking_pending_client: "Solicitação recebida, aguardando confirmação (para a cliente)",
  booking_cancelled_client: "Agendamento cancelado (para a cliente)",
  booking_rescheduled_client: "Agendamento reagendado (para a cliente)",
  reminder_24h: "Lembrete 24 horas antes",
  reminder_2h: "Lembrete 2 horas antes",
  booking_new_business: "Novo agendamento online (para o negócio)",
  booking_cancelled_business: "Cancelamento pela cliente (para o negócio)",
};

export const DEFAULT_TEMPLATES: Record<TemplateKey, { subject: string; body: string }> = {
  booking_confirmed_client: {
    subject: "Seu horário está confirmado – {{empresa}}",
    body:
      "Olá, {{cliente}}!\n\nSeu agendamento está confirmado:\n\n{{servico}} com {{profissional}}\n{{data}} às {{hora}}\n{{endereco}}\n\nCódigo: {{codigo}}\n\nPara ver, cancelar ou reagendar, use este link:\n{{link}}\n\nAté breve!\n{{empresa}}",
  },
  booking_pending_client: {
    subject: "Recebemos seu pedido de agendamento – {{empresa}}",
    body:
      "Olá, {{cliente}}!\n\nRecebemos seu pedido para {{servico}} em {{data}} às {{hora}}. Você receberá a confirmação em breve.\n\nCódigo: {{codigo}}\nAcompanhe pelo link: {{link}}\n\n{{empresa}}",
  },
  booking_cancelled_client: {
    subject: "Agendamento cancelado – {{empresa}}",
    body:
      "Olá, {{cliente}}.\n\nSeu agendamento de {{servico}} em {{data}} às {{hora}} foi cancelado.\n\nQuando quiser, é só agendar um novo horário: {{link_empresa}}\n\n{{empresa}}",
  },
  booking_rescheduled_client: {
    subject: "Seu horário foi alterado – {{empresa}}",
    body:
      "Olá, {{cliente}}!\n\nSeu agendamento foi alterado para:\n\n{{servico}} com {{profissional}}\n{{data}} às {{hora}}\n\nCódigo: {{codigo}}\nDetalhes: {{link}}\n\n{{empresa}}",
  },
  reminder_24h: {
    subject: "Lembrete: amanhã às {{hora}} – {{empresa}}",
    body:
      "Olá, {{cliente}}!\n\nPassando para lembrar do seu horário:\n\n{{servico}} com {{profissional}}\n{{data}} às {{hora}}\n{{endereco}}\n\nSe precisar cancelar ou reagendar: {{link}}\n\n{{empresa}}",
  },
  reminder_2h: {
    subject: "Daqui a pouco: {{servico}} às {{hora}}",
    body: "Olá, {{cliente}}! Seu horário é hoje às {{hora}} ({{servico}}). Te esperamos!\n{{endereco}}\n\n{{empresa}}",
  },
  booking_new_business: {
    subject: "Novo agendamento: {{cliente}} – {{data}} {{hora}}",
    body:
      "Novo agendamento online:\n\nCliente: {{cliente}} ({{telefone}})\nServiço: {{servico}}\nProfissional: {{profissional}}\nData: {{data}} às {{hora}}\nCódigo: {{codigo}}\n\nVer no painel: {{link_painel}}",
  },
  booking_cancelled_business: {
    subject: "Cancelado pela cliente: {{cliente}} – {{data}} {{hora}}",
    body:
      "{{cliente}} cancelou o agendamento de {{servico}} em {{data}} às {{hora}}.\nMotivo: {{motivo}}\n\nO horário já está livre novamente na agenda.",
  },
};

export function render(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

/* ------------------------------------------------------------------ */
/* Adaptadores de canal — trocar o provedor não muda o domínio         */
/* ------------------------------------------------------------------ */

type SendResult = { status: "sent" | "failed" | "simulated" | "skipped"; provider: string; id?: string; error?: string };

interface ChannelAdapter {
  channel: "email" | "whatsapp" | "sms";
  send(msg: { to: string; subject: string; text: string }): Promise<SendResult>;
}

const resendEmail: ChannelAdapter = {
  channel: "email",
  async send({ to, subject, text }) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      // Sem provedor configurado: registra a mensagem como simulada (aparece no painel em Notificações).
      return { status: "simulated", provider: "simulado" };
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Agenda <onboarding@resend.dev>",
          to: [to],
          subject,
          text,
          html: textToHtml(text),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) return { status: "failed", provider: "resend", error: json.message ?? `HTTP ${res.status}` };
      return { status: "sent", provider: "resend", id: json.id };
    } catch (e) {
      return { status: "failed", provider: "resend", error: (e as Error).message };
    }
  },
};

/** Ponto de extensão para WhatsApp (ex.: Z-API, Twilio, Meta Cloud API). Ainda não configurado. */
const whatsappAdapter: ChannelAdapter = {
  channel: "whatsapp",
  async send() {
    return { status: "skipped", provider: "nao-configurado" };
  },
};

const ADAPTERS = { email: resendEmail, whatsapp: whatsappAdapter } as const;

function textToHtml(text: string) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linked = esc.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#8a3d5c">$1</a>');
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#2b1d24;max-width:520px">${linked.replace(/\n/g, "<br>")}</div>`;
}

/* ------------------------------------------------------------------ */
/* Envio para um agendamento                                           */
/* ------------------------------------------------------------------ */

export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function manageUrl(slug: string, code: string, token?: string | null) {
  return `${appUrl()}/${slug}/agendamento/${code}${token ? `?t=${token}` : ""}`;
}

type NotifyArgs = {
  appointmentId: string;
  key: TemplateKey;
  /** Token de gestão em texto puro (só disponível na criação/reagendamento). */
  manageToken?: string | null;
  extra?: Record<string, string>;
  dedupeKey?: string;
};

export async function notifyAppointment({ appointmentId, key, manageToken, extra, dedupeKey }: NotifyArgs) {
  try {
    const [row] = await db
      .select({
        appt: schema.appointments,
        client: schema.clients,
        prof: schema.professionals,
        org: schema.organizations,
      })
      .from(schema.appointments)
      .innerJoin(schema.clients, eq(schema.clients.id, schema.appointments.clientId))
      .innerJoin(schema.professionals, eq(schema.professionals.id, schema.appointments.professionalId))
      .innerJoin(schema.organizations, eq(schema.organizations.id, schema.appointments.organizationId))
      .where(eq(schema.appointments.id, appointmentId))
      .limit(1);
    if (!row) return;
    const { appt, client, prof, org } = row;

    const toBusiness = key === "booking_new_business" || key === "booking_cancelled_business";
    const recipient = toBusiness ? org.settings?.notifyBusinessEmail || org.email : client.email;
    const channel = "email" as const;

    const [custom] = await db
      .select()
      .from(schema.messageTemplates)
      .where(
        and(
          eq(schema.messageTemplates.organizationId, org.id),
          eq(schema.messageTemplates.key, key),
          eq(schema.messageTemplates.channel, channel),
        ),
      )
      .limit(1);
    if (custom && !custom.enabled) return;
    const tpl = custom ?? DEFAULT_TEMPLATES[key];

    const vars: Record<string, string> = {
      cliente: client.name.split(" ")[0] || client.name,
      cliente_completo: client.name,
      telefone: client.phone,
      servico: appt.serviceName,
      profissional: prof.name,
      data: fmtLongDate(appt.startsAt, org.timezone),
      hora: fmtTime(appt.startsAt, org.timezone),
      empresa: org.name,
      endereco: org.address,
      codigo: appt.code,
      link: manageUrl(org.slug, appt.code, manageToken),
      link_empresa: `${appUrl()}/${org.slug}`,
      link_painel: `${appUrl()}/painel/agendamentos/${appt.id}`,
      motivo: appt.cancelReason || "não informado",
      ...extra,
    };
    const subject = render(tpl.subject, vars);
    const body = render(tpl.body, vars);

    if (!recipient) {
      await db.insert(schema.notifications).values({
        organizationId: org.id, appointmentId, recipientType: toBusiness ? "business" : "client", channel,
        recipient: "", templateKey: key, subject, body, status: "skipped", provider: "",
        error: toBusiness ? "Empresa sem e-mail para notificações" : "Cliente sem e-mail", dedupeKey: dedupeKey ?? null,
      }).onConflictDoNothing();
      return;
    }

    // registra antes de enviar; a chave de deduplicação impede envio duplicado (ex.: lembretes)
    const inserted = await db
      .insert(schema.notifications)
      .values({
        organizationId: org.id, appointmentId, recipientType: toBusiness ? "business" : "client", channel,
        recipient, templateKey: key, subject, body, status: "queued", dedupeKey: dedupeKey ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: schema.notifications.id });
    if (inserted.length === 0) return;

    const result = await ADAPTERS[channel].send({ to: recipient, subject, text: body });
    await db
      .update(schema.notifications)
      .set({
        status: result.status,
        provider: result.provider,
        providerMessageId: result.id ?? null,
        error: result.error ?? null,
        attempts: 1,
        sentAt: result.status === "sent" ? new Date() : null,
      })
      .where(eq(schema.notifications.id, inserted[0].id));
  } catch (e) {
    console.error("[notify] erro ao notificar", key, appointmentId, e);
  }
}
