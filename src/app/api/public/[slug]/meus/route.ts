import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canClientChange } from "@/lib/availability";
import { getAppointmentByToken, getOrgBySlug, orgSettings } from "@/lib/booking";
import { manageUrl } from "@/lib/notify";
import { fmtMoney, fmtTime } from "@/lib/time";

const body = z.object({
  items: z.array(z.object({ code: z.string().min(4).max(12), token: z.string().min(10).max(100) })).max(40),
});

/**
 * "Meus horários": a cliente guarda no aparelho o código e o token de cada pedido.
 * Só quem tem o token vê o agendamento (o mesmo do link de gestão).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return NextResponse.json({ error: "Negócio não encontrado." }, { status: 404 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  const s = orgSettings(org);
  const tz = org.timezone;
  const now = new Date();
  const rows = await Promise.all(parsed.data.items.map((i) => getAppointmentByToken(org.id, i.code, i.token).then((r) => (r ? { r, token: i.token } : null))));
  const list = rows
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map(({ r, token }) => {
      const a = r.appt;
      const ativo = (a.status === "pending" || a.status === "confirmed") && a.startsAt > now;
      return {
        code: a.code,
        status: a.status,
        servico: a.serviceName,
        profissional: r.prof.name,
        inicio: a.startsAt.toISOString(),
        dia: a.startsAt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: tz }).replace(".", ""),
        hora: fmtTime(a.startsAt, tz),
        valor: fmtMoney(Math.max(0, a.priceCents - a.discountCents)),
        ativo,
        podeCancelar: ativo && canClientChange(a.startsAt, now, s.cancelUntilHours),
        podeRemarcar: ativo && canClientChange(a.startsAt, now, s.rescheduleUntilHours),
        link: manageUrl(org.slug, a.code, token).replace(/^https?:\/\/[^/]+/, ""),
      };
    })
    .sort((x, y) => (x.ativo === y.ativo ? (x.ativo ? x.inicio.localeCompare(y.inicio) : y.inicio.localeCompare(x.inicio)) : x.ativo ? -1 : 1));
  return NextResponse.json({ items: list }, { headers: { "Cache-Control": "no-store" } });
}
