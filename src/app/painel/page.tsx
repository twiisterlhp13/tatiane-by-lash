import Link from "next/link";
import { eq } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { publicAvailability } from "@/lib/booking";
import { ehExtensao, msg, primeiroNome, separar, unidade } from "@/lib/lash";
import {
  brl, custoMedio, faturamento, periodos, sumidas,
  type Ag,
} from "@/lib/negocio";
import { loadAgs, loadClientes, loadDespesas, loadEstoque, loadServicos } from "@/lib/painel-data";
import { appUrl } from "@/lib/notify";
import { whatsappLink } from "@/lib/security";
import { addDays, fmtTime, localMinuteOfDay, utcToLocalParts } from "@/lib/time";
import { Group, SectionTitle, TimeCell, btn } from "@/components/app";
import { LinhaDoDia } from "./linha-do-dia";
import { BemVinda, ConcluirButton, FacaAgora, PedidoActions, PergunteIA, type Sugestao } from "./inicio-client";

export const metadata = { title: "Início" };

const ucf = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function Inicio({ searchParams }: { searchParams: Promise<{ "bem-vinda"?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const tz = ctx.org.timezone;
  const now = new Date();
  const p = periodos(now, tz);

  const [ags, desp, estoque, clientes, servicos, hoursRows, [org]] = await Promise.all([
    loadAgs(ctx, { pastDays: 400, futureDays: 90 }),
    loadDespesas(ctx.org.id, p.mesAnt),
    loadEstoque(ctx.org.id),
    loadClientes(ctx.org.id),
    loadServicos(ctx.org.id),
    ctx.professionalId
      ? db.select().from(schema.professionalHours).where(eq(schema.professionalHours.professionalId, ctx.professionalId))
      : db.select().from(schema.businessHours).where(eq(schema.businessHours.organizationId, ctx.org.id)),
    db.select().from(schema.organizations).where(eq(schema.organizations.id, ctx.org.id)),
  ]);

  const hm = (d: Date) => fmtTime(d, tz);
  const link = `${appUrl()}/${ctx.org.slug}`;

  /* ---------------- o dia em dinheiro ---------------- */
  const doDia = ags
    .filter((a) => ["confirmed", "completed"].includes(a.status) && a.startsAt >= p.i0 && a.startsAt < p.i1)
    .sort((a, b) => +a.startsAt - +b.startsAt);
  const fat = doDia.reduce((t, a) => t + a.valueCents, 0);
  const cm = custoMedio(ags, desp, p);
  const luc = fat - cm * doDia.length;
  const ultimoFim = doDia.length ? new Date(Math.max(...doDia.map((a) => +a.endsAt))) : null;
  const cur = faturamento(ags, p.m0, p.m1);
  const prev = faturamento(ags, p.mp, p.m0);
  const prevPar = (prev * p.diaMes) / p.diasMes;
  const pend = ags.filter((a) => a.status === "pending" && a.endsAt > now);

  // janela da linha do dia: expediente de hoje (ou o horário dos atendimentos)
  const wd = utcToLocalParts(now, tz).weekday;
  const hojeRows = hoursRows.filter((h) => h.weekday === wd);
  const minsDia = [...doDia, ...pend.filter((a) => a.startsAt >= p.i0 && a.startsAt < p.i1)];
  const ini = Math.min(hojeRows.length ? Math.min(...hojeRows.map((h) => h.startMinute)) : 9 * 60, ...minsDia.map((a) => localMinuteOfDay(a.startsAt, tz)));
  const fim = Math.max(hojeRows.length ? Math.max(...hojeRows.map((h) => h.endMinute)) : 19 * 60, ...minsDia.map((a) => localMinuteOfDay(a.endsAt, tz) || 24 * 60));
  const itensLinha = minsDia.map((a) => ({ startMin: localMinuteOfDay(a.startsAt, tz), endMin: localMinuteOfDay(a.endsAt, tz) || 24 * 60, status: a.status }));

  /* ---------------- próxima cliente ---------------- */
  const abertos = doDia.filter((a) => a.status === "confirmed");
  const prox: Ag | undefined = abertos[0] ?? ags.filter((a) => a.status === "confirmed" && a.startsAt >= p.i1).sort((a, b) => +a.startsAt - +b.startsAt)[0];
  const proxHoje = !!prox && prox.startsAt < p.i1;
  const resto = abertos.slice(1);

  /* ---------------- faça agora ---------------- */
  const sug: Sugestao[] = [];
  for (const c of sumidas(ags, now).slice(0, 2)) {
    const texto = msg.voltar(c.nome, c.servico, c.extensao);
    sug.push({
      id: `rt-${c.clientId}`,
      tag: c.extensao ? "Manutenção" : "Cliente para chamar",
      titulo: `${c.nome} não volta há ${c.dias} dias`,
      texto: c.extensao
        ? `A última foi ${c.servico}. A manutenção é a cada 15 a 21 dias. A mensagem já está pronta.`
        : `A última foi ${c.servico}. A mensagem já está pronta.`,
      acoes: c.tel
        ? [{ kind: "link", label: "Mandar no WhatsApp", href: whatsappLink(c.tel, texto), primary: true }]
        : [{ kind: "link", label: "Ver cliente", href: `/painel/clientes/${c.clientId}` }],
    });
  }
  const baixo = estoque.filter((i) => i.quantity <= i.minimum);
  if (baixo.length) {
    sug.push({
      id: `est-${baixo.map((i) => i.id).join(".").slice(0, 60)}`,
      tag: "Estoque",
      titulo: `Repor ${baixo.length} ${baixo.length > 1 ? "itens" : "item"} antes de faltar`,
      texto: baixo.slice(0, 3).map((i) => `${i.name} (${i.quantity} ${unidade(i.unit, i.quantity)})`).join(", "),
      acoes: [{ kind: "link", label: "Ver estoque", href: "/painel/negocio?aba=estoque", primary: true }],
    });
  }
  const paraConcluir = ags.filter((a) => a.status === "confirmed" && a.endsAt < now && a.startsAt > new Date(+now - 30 * 86400000));
  if (paraConcluir.length) {
    sug.push({
      id: `pc-${paraConcluir.length}-${p.today}`,
      tag: "Agente de receita",
      titulo: `${paraConcluir.length} ${paraConcluir.length > 1 ? "atendimentos já passaram e não foram concluídos" : "atendimento já passou e não foi concluído"}`,
      texto: "Concluir deixa o faturamento e o histórico das clientes certinhos.",
      acoes: [{ kind: "link", label: "Ver na agenda", href: "/painel/agenda#para-concluir", primary: true }],
    });
  }
  // horários livres amanhã, pelo procedimento mais feito
  if (org?.onlineBookingEnabled && servicos.length) {
    const cont = new Map<string, number>();
    for (const a of ags) if (a.status === "completed" && a.startsAt > new Date(+now - 90 * 86400000)) cont.set(a.serviceName, (cont.get(a.serviceName) ?? 0) + 1);
    const top = [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const svc = servicos.find((s) => s.name === top && s.onlineVisible) ?? servicos.find((s) => s.onlineVisible);
    if (svc) {
      try {
        const amanha = addDays(p.today, 1);
        const [d] = await publicAvailability({ org, serviceId: svc.id, professionalId: "any", fromDate: amanha, days: 1, now });
        const passo = (svc.durationMinutes + svc.bufferMinutes) * 60000;
        const livres: Date[] = [];
        let fimUlt = 0;
        for (const s of d?.slots ?? []) if (+s.start >= fimUlt) { livres.push(s.start); fimUlt = +s.start + passo; }
        if (livres.length >= 2) {
          const horas = livres.slice(0, 4).map((x) => hm(x));
          const texto = msg.divulgar(livres.length, link);
          sug.push({
            id: `livres-${amanha}`,
            tag: "Agente de agenda",
            titulo: `Amanhã ainda cabem ${livres.length} atendimentos de ${svc.name}`,
            texto: `Horários livres a partir de ${horas.join(", ")}. Divulgue no status do WhatsApp ou no Instagram.`,
            acoes: [
              { kind: "link", label: "Divulgar no WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(texto)}`, primary: true },
              { kind: "copy", label: "Copiar mensagem", text: texto },
            ],
          });
        }
      } catch {
        /* sem sugestão de horários se a disponibilidade falhar */
      }
    }
  }
  // aniversariantes dos próximos 7 dias
  const proximos7 = Array.from({ length: 7 }, (_, i) => addDays(p.today, i).slice(5));
  for (const c of clientes) {
    if (!c.birthDate) continue;
    const md = c.birthDate.slice(5);
    const idx = proximos7.indexOf(md);
    if (idx < 0) continue;
    const quando = idx === 0 ? "hoje" : idx === 1 ? "amanhã" : `dia ${Number(md.slice(3))}`;
    sug.push({
      id: `aniv-${c.id}-${p.today.slice(0, 4)}`,
      tag: "Agente de marketing",
      titulo: `${c.name} faz aniversário ${quando}`,
      texto: "Um carinho no dia certo faz a cliente voltar. A mensagem já está pronta.",
      acoes: c.phone ? [{ kind: "link", label: "Mandar parabéns", href: whatsappLink(c.phone, msg.aniversario(c.name)), primary: true }] : [{ kind: "link", label: "Ver cliente", href: `/painel/clientes/${c.id}` }],
    });
  }

  const hora = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now));
  const sd = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const dataExt = ucf(now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: tz }));
  const variacao = prev > 0 ? Math.round(((cur - prevPar) / Math.max(prevPar, 1)) * 100) : null;
  const quandoProx = prox
    ? proxHoje
      ? hm(prox.startsAt)
      : `${ucf(prox.startsAt.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", timeZone: tz }).replace(".", ""))}, ${hm(prox.startsAt)}`
    : "";

  return (
    <div>
      <p className="text-[14px] font-medium text-muted">{dataExt}</p>
      <h1 className="mt-0.5 text-[28px] font-bold leading-tight">{sd}, {primeiroNome(ctx.user.name)}.</h1>

      {sp["bem-vinda"] === "1" && <BemVinda link={link} />}

      {/* Seu dia */}
      <section className="mt-5 rounded-[28px] bg-gel px-5 pt-5 pb-4 text-gel-ink" aria-labelledby="seu-dia">
        <h2 id="seu-dia" className="text-[15px] font-bold">Seu dia</h2>
        {doDia.length ? (
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
            <div>
              <p className="text-[13px] font-medium">Entra hoje</p>
              <p className="tnum text-[30px] font-bold leading-none tracking-tight whitespace-nowrap text-rimel">{brl(fat)}</p>
            </div>
            {cm > 0 && (
              <div>
                <p className="text-[13px] font-medium">Lucro estimado</p>
                <p className={`tnum text-[30px] font-bold leading-none tracking-tight whitespace-nowrap ${luc < 0 ? "text-framboesa" : "text-rimel"}`}>{brl(luc)}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-[30px] font-bold leading-none tracking-tight text-rimel">Dia livre</p>
        )}
        <LinhaDoDia className="mt-3 w-full max-w-[520px]" items={itensLinha} ini={ini} fim={fim} agora={localMinuteOfDay(now, tz)} />
        <p className="mt-2 text-[14px] leading-snug">
          {doDia.length
            ? `${doDia.length} atendimento${doDia.length > 1 ? "s" : ""}` +
              (cm ? `, custo médio de ${brl(cm)} por atendimento` : "") +
              (ultimoFim && ultimoFim > now ? `. Livre a partir das ${hm(ultimoFim)}.` : ".")
            : "Nenhum atendimento marcado. Bom dia para divulgar horários ou chamar clientes antigas."}
        </p>
        {variacao !== null && (
          <p className="mt-3 border-t border-gel-ink/15 pt-3 text-[14px]">
            No mês: <b className="tnum">{brl(cur)}</b>, {variacao >= 0 ? "▲" : "▼"} {Math.abs(variacao)}% em relação ao mesmo ponto do mês passado
          </p>
        )}
      </section>

      {/* Pedidos */}
      {pend.length > 0 && (
        <>
          <SectionTitle>Pedidos de horário</SectionTitle>
          <Group>
            {pend.map((a) => (
              <div key={a.id} className="px-4 py-3.5">
                <div className="flex items-center gap-3.5">
                  <TimeCell time={hm(a.startsAt)} sub={a.startsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: tz })} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold">{a.clientName}</p>
                    <p className="truncate text-[13px] text-muted">{a.serviceName}, {brl(a.valueCents)}</p>
                  </div>
                </div>
                <div className="mt-2.5 pl-[72px]"><PedidoActions id={a.id} tel={a.clientPhone} /></div>
              </div>
            ))}
          </Group>
        </>
      )}

      {/* Próxima cliente */}
      <SectionTitle action={<Link href="/painel/agenda?novo=1" className={btn.text}>Agendar</Link>}>
        {prox ? (proxHoje ? "Próxima cliente" : "Próximo atendimento") : "Próximo atendimento"}
      </SectionTitle>
      {prox ? (
        <div className="rounded-[24px] border-[1.5px] border-rimel bg-white p-5">
          <div className="flex items-baseline gap-2">
            <span className="tnum text-[26px] font-bold leading-none">{quandoProx}</span>
            <span className="text-[13px] text-muted">até {hm(prox.endsAt)}</span>
          </div>
          <p className="mt-2 text-[19px] font-bold leading-tight">{prox.clientName}</p>
          <p className="text-[14px] text-ink-2">{prox.serviceName}, {brl(prox.valueCents)}</p>
          <div className="mt-3 rounded-2xl bg-paper-2 px-4 py-3 text-[14px]">
            <p className="text-[12px] font-bold text-ink-2">Separar</p>
            <p>{separar(prox.serviceName)}</p>
            {prox.notes && <p className="mt-1 text-muted italic">{prox.notes}</p>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {prox.clientPhone && (
              <a
                className={btn.mini}
                target="_blank"
                rel="noopener"
                href={whatsappLink(prox.clientPhone, msg.confirmar(prox.clientName, proxHoje ? "hoje" : `em ${prox.startsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: tz })}`, hm(prox.startsAt), prox.serviceName))}
              >
                Confirmar no WhatsApp
              </a>
            )}
            {proxHoje && <ConcluirButton id={prox.id} />}
            <Link href={`/painel/agendamentos/${prox.id}`} className={btn.mini}>Detalhes</Link>
          </div>
          {ehExtensao(prox.serviceName) && !proxHoje && <p className="mt-3 text-[13px] text-muted">Lembre a cliente de vir sem rímel e com os cílios limpos.</p>}
        </div>
      ) : (
        <div className="rounded-[22px] border border-dashed border-line-2 px-5 py-6 text-center text-[14px] text-muted">
          Nenhum atendimento à frente. Compartilhe seu link para receber pedidos.
        </div>
      )}
      {resto.length > 0 && (
        <>
          <p className="mt-5 mb-2 text-[14px] font-semibold text-muted">Depois, hoje</p>
          <Group>
            {resto.map((a) => (
              <Link key={a.id} href={`/painel/agendamentos/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                <span className="tnum w-12 text-[15px] font-bold">{hm(a.startsAt)}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink-2">{a.clientName}, {a.serviceName}</span>
                <span className="tnum text-[14px] font-semibold">{brl(a.valueCents)}</span>
                <ChevronRight size={16} className="text-muted" />
              </Link>
            ))}
          </Group>
        </>
      )}

      <FacaAgora itens={sug} />

      <PergunteIA />
    </div>
  );
}

