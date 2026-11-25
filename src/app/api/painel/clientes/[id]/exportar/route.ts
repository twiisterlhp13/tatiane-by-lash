import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCtx } from "@/lib/auth";
import { audit } from "@/lib/audit";

/** LGPD: exporta os dados pessoais e o histórico de uma cliente. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!ctx.can("clients.privacy")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { id } = await params;
  const [c] = await db.select().from(schema.clients).where(and(eq(schema.clients.id, id), eq(schema.clients.organizationId, ctx.org.id))).limit(1);
  if (!c) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  const appts = await db.select({
    codigo: schema.appointments.code, servico: schema.appointments.serviceName, inicio: schema.appointments.startsAt, fim: schema.appointments.endsAt,
    situacao: schema.appointments.status, origem: schema.appointments.source, preco_centavos: schema.appointments.priceCents,
    desconto_centavos: schema.appointments.discountCents, observacao_cliente: schema.appointments.clientNotes, criado_em: schema.appointments.createdAt,
  }).from(schema.appointments).where(eq(schema.appointments.clientId, c.id));
  const notifications = await db.select({
    canal: schema.notifications.channel, destinatario: schema.notifications.recipient, assunto: schema.notifications.subject,
    situacao: schema.notifications.status, data: schema.notifications.createdAt,
  }).from(schema.notifications).innerJoin(schema.appointments, eq(schema.appointments.id, schema.notifications.appointmentId))
    .where(and(eq(schema.appointments.clientId, c.id), eq(schema.notifications.recipientType, "client")));
  await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "client.exported", entity: "client", entityId: c.id });
  const body = {
    controlador: { empresa: ctx.org.name },
    gerado_em: new Date().toISOString(),
    titular: {
      nome: c.name, telefone: c.phone, email: c.email, data_nascimento: c.birthDate, observacoes: c.notes,
      termos_aceitos_em: c.termsAcceptedAt, consentimento_marketing: c.marketingConsent, consentimento_marketing_em: c.marketingConsentAt, cadastrada_em: c.createdAt,
    },
    agendamentos: appts,
    mensagens: notifications,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dados-cliente-${c.id.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
