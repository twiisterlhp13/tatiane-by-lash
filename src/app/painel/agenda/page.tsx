import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { brl, periodos } from "@/lib/negocio";
import { loadAgs, loadClientes, loadProfissionais, loadServicos } from "@/lib/painel-data";
import { fmtTime, toLocalDate } from "@/lib/time";
import { AgendaView, type ItemAgenda } from "./agenda-view";

export const metadata = { title: "Agenda" };

const ucf = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ novo?: string; bloquear?: string; data?: string }> }) {
  const sp = await searchParams;
  if (sp.bloquear === "1") redirect("/painel/agenda/semana?bloquear=1");
  const ctx = await requireCtx();
  const tz = ctx.org.timezone;
  const now = new Date();
  const p = periodos(now, tz);
  const [ags, servicos, pros, clientes, links] = await Promise.all([
    loadAgs(ctx, { pastDays: 30, futureDays: 120 }),
    loadServicos(ctx.org.id),
    loadProfissionais(ctx.org.id),
    loadClientes(ctx.org.id),
    db.select().from(schema.professionalServices).where(eq(schema.professionalServices.organizationId, ctx.org.id)),
  ]);

  const amanha = toLocalDate(new Date(+p.i1 + 3600000), tz);
  const diaLabel = (d: Date) => {
    const ld = toLocalDate(d, tz);
    if (ld === p.today) return "Hoje";
    if (ld === amanha) return "Amanhã";
    return ucf(d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: tz }));
  };
  const item = (a: (typeof ags)[number]): ItemAgenda => ({
    id: a.id,
    dia: diaLabel(a.startsAt),
    hora: fmtTime(a.startsAt, tz),
    fim: fmtTime(a.endsAt, tz),
    data: a.startsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: tz }),
    cliente: a.clientName,
    tel: a.clientPhone,
    servico: a.serviceName,
    valor: brl(a.valueCents),
    profissional: pros.length > 1 ? a.professionalName : "",
    comecou: a.startsAt <= now,
  });

  const pedidos = ags.filter((a) => a.status === "pending" && a.endsAt > now).map(item);
  const paraConcluir = ags.filter((a) => a.status === "confirmed" && a.endsAt <= now).reverse().map(item);
  const proximos = ags.filter((a) => a.status === "confirmed" && a.endsAt > now).map(item);

  const visiveis = ctx.can("agenda.manage_all") ? pros : pros.filter((x) => x.id === ctx.professionalId);

  return (
    <AgendaView
      pedidos={pedidos}
      paraConcluir={paraConcluir}
      proximos={proximos}
      abrirNovo={sp.novo === "1"}
      hoje={p.today}
      dataInicial={sp.data}
      servicos={servicos.map((s) => ({
        id: s.id,
        nome: s.name,
        precoCents: s.priceCents,
        duracao: s.durationMinutes,
        profissionais: links.filter((l) => l.serviceId === s.id).map((l) => l.professionalId),
      }))}
      profissionais={visiveis.map((x) => ({ id: x.id, nome: x.name }))}
      minhaProfissional={ctx.professionalId}
      clientes={clientes.map((c) => ({ id: c.id, nome: c.name, tel: c.phone }))}
    />
  );
}
