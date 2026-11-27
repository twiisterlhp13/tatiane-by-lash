import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { appUrl } from "@/lib/notify";
import { loadHorario, loadServicos, textoHorario } from "@/lib/painel-data";
import { fmtDuration, fmtMoney } from "@/lib/time";
import { VitrineView } from "./vitrine-view";

export const metadata = { title: "Vitrine" };

export default async function VitrinePage() {
  const ctx = await requireCtx();
  const [[org], servicos, horario, fotos] = await Promise.all([
    db.select().from(schema.organizations).where(eq(schema.organizations.id, ctx.org.id)),
    loadServicos(ctx.org.id),
    loadHorario(ctx.org.id, ctx.professionalId),
    db.select({ id: schema.portfolioPhotos.id, caption: schema.portfolioPhotos.caption }).from(schema.portfolioPhotos)
      .where(eq(schema.portfolioPhotos.organizationId, ctx.org.id)).orderBy(asc(schema.portfolioPhotos.sortOrder), asc(schema.portfolioPhotos.createdAt)),
  ]);
  const link = `${appUrl()}/${org.slug}`;
  return (
    <VitrineView
      podeEditar={ctx.can("settings.manage")}
      podeServicos={ctx.can("services.manage")}
      link={link}
      slug={org.slug}
      perfil={{
        nome: org.name,
        foto: org.logoUrl,
        instagram: org.instagram,
        area: org.area,
        bio: org.description,
        whatsapp: org.whatsapp,
        especialidades: org.specialties ?? [],
      }}
      horario={{ weekdays: horario.weekdays, ini: horario.ini ?? "09:00", fim: horario.fim ?? "19:00", pausa: horario.pausa, texto: textoHorario(horario), uniforme: horario.uniforme }}
      servicos={servicos.map((s) => ({
        id: s.id,
        nome: s.name,
        descricao: s.description,
        precoCents: s.priceCents,
        preco: fmtMoney(s.priceCents),
        aPartir: s.priceFrom,
        minutos: s.durationMinutes,
        duracao: fmtDuration(s.durationMinutes),
        online: s.onlineVisible,
      }))}
      fotos={fotos.map((f) => ({ id: f.id, src: `/api/public/${org.slug}/foto/${f.id}`, legenda: f.caption }))}
    />
  );
}
