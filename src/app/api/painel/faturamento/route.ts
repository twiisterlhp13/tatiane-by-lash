import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCtx } from "@/lib/auth";
import { fmtDate, fmtTime, localToUtc } from "@/lib/time";
import { STATUS_LABEL } from "@/components/ui";

/** Exporta o faturamento do mês em CSV (abre no Excel / Google Planilhas). */
export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!ctx.can("reports.view")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const tz = ctx.org.timezone;
  const ym = req.nextUrl.searchParams.get("mes") ?? "";
  if (!/^\d{4}-\d{2}$/.test(ym)) return NextResponse.json({ error: "Mês inválido" }, { status: 400 });
  const situacao = req.nextUrl.searchParams.get("situacao");
  const statuses = situacao === "concluidos" ? ["completed"] : situacao === "previstos" ? ["pending", "confirmed"] : ["pending", "confirmed", "completed"];
  const [y, m] = ym.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  const from = localToUtc(`${ym}-01`, 0, tz);
  const to = localToUtc(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`, 0, tz);

  const rows = await db
    .select({ a: schema.appointments, client: schema.clients.name, prof: schema.professionals.name })
    .from(schema.appointments)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.appointments.clientId))
    .innerJoin(schema.professionals, eq(schema.professionals.id, schema.appointments.professionalId))
    .where(and(
      eq(schema.appointments.organizationId, ctx.org.id),
      gte(schema.appointments.startsAt, from),
      lt(schema.appointments.startsAt, to),
      inArray(schema.appointments.status, statuses as ("pending" | "confirmed" | "completed")[]),
    ))
    .orderBy(asc(schema.appointments.startsAt));

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const money = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const lines = [
    ["Data", "Início", "Fim", "Cliente", "Serviço", "Profissional", "Situação", "Preço", "Desconto", "Total", "Recebido", "Forma de pagamento", "Código"].join(";"),
    ...rows.map(({ a, client, prof }) =>
      [
        fmtDate(a.startsAt, tz), fmtTime(a.startsAt, tz), fmtTime(a.endsAt, tz), esc(client), esc(a.serviceName), esc(prof),
        STATUS_LABEL[a.status] ?? a.status, money(a.priceCents), money(a.discountCents), money(a.priceCents - a.discountCents),
        money(a.paidCents), esc(a.paymentMethod), a.code,
      ].join(";"),
    ),
  ];
  // BOM para o Excel reconhecer acentos
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="faturamento-${ym}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
