import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getOrgBySlug, orgSettings } from "@/lib/booking";
import { resumoHorario, textoHorario } from "@/lib/painel-data";
import { fmtDuration, fmtMoney, toLocalDate } from "@/lib/time";
import { ClienteApp } from "./cliente-app";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ aba?: string; servico?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return { title: "Página não encontrada" };
  const desc = org.description.slice(0, 160) || `Cílios e sobrancelhas com hora marcada. Agende online com ${org.name}.`;
  return {
    title: { absolute: `${org.name} · Agende seu horário` },
    description: desc,
    openGraph: { title: `${org.name} · Agende seu horário`, description: desc },
  };
}

export default async function VitrinePublica({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const org = await getOrgBySlug(slug.toLowerCase());
  if (!org) notFound();
  if (org.slug !== slug) permanentRedirect(`/${org.slug}`);
  const settings = orgSettings(org);
  const [services, pros, links, hours, fotos] = await Promise.all([
    db.select().from(schema.services)
      .where(and(eq(schema.services.organizationId, org.id), eq(schema.services.active, true), eq(schema.services.onlineVisible, true)))
      .orderBy(asc(schema.services.sortOrder), asc(schema.services.name)),
    db.select().from(schema.professionals)
      .where(and(eq(schema.professionals.organizationId, org.id), eq(schema.professionals.active, true), eq(schema.professionals.acceptsOnline, true)))
      .orderBy(asc(schema.professionals.sortOrder), asc(schema.professionals.name)),
    db.select().from(schema.professionalServices).where(eq(schema.professionalServices.organizationId, org.id)),
    db.select().from(schema.businessHours).where(eq(schema.businessHours.organizationId, org.id)),
    db.select({ id: schema.portfolioPhotos.id, caption: schema.portfolioPhotos.caption }).from(schema.portfolioPhotos)
      .where(eq(schema.portfolioPhotos.organizationId, org.id)).orderBy(asc(schema.portfolioPhotos.sortOrder), asc(schema.portfolioPhotos.createdAt)),
  ]);
  const proIds = new Set(pros.map((p) => p.id));
  const bookable = services
    .map((s) => ({ ...s, professionalIds: links.filter((l) => l.serviceId === s.id && proIds.has(l.professionalId)).map((l) => l.professionalId) }))
    .filter((s) => s.professionalIds.length > 0);

  return (
    <ClienteApp
      slug={org.slug}
      abaInicial={sp.aba === "meus" ? "meus" : "vitrine"}
      servicoInicial={sp.servico}
      hoje={toLocalDate(new Date(), org.timezone)}
      agendamentoOnline={org.onlineBookingEnabled && bookable.length > 0}
      confirmaNaHora={settings.autoConfirmOnline}
      exigeEmail={settings.requireEmail}
      politica={settings.policyText}
      perfil={{
        nome: org.name,
        foto: org.logoUrl,
        instagram: org.instagram,
        area: org.area,
        bio: org.description,
        whatsapp: org.whatsapp || org.phone,
        especialidades: org.specialties ?? [],
        horario: textoHorario(resumoHorario(hours)),
      }}
      servicos={bookable.map((s) => ({
        id: s.id,
        nome: s.name,
        descricao: s.description,
        duracao: fmtDuration(s.durationMinutes),
        preco: fmtMoney(s.priceCents),
        aPartir: s.priceFrom,
        profissionais: s.professionalIds,
      }))}
      profissionais={pros.map((p) => ({ id: p.id, nome: p.name }))}
      fotos={fotos.map((f) => ({ id: f.id, src: `/api/public/${org.slug}/foto/${f.id}`, legenda: f.caption }))}
    />
  );
}
