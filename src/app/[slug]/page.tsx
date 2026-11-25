import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { AtSign, MapPin, MessageCircle, Phone } from "lucide-react";
import { db, schema } from "@/db";
import { getOrgBySlug, orgSettings } from "@/lib/booking";
import { formatPhone, whatsappLink } from "@/lib/security";
import { minutesToHHMM, toLocalDate } from "@/lib/time";
import { BookingWizard } from "./booking-wizard";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return { title: "Página não encontrada" };
  return {
    title: { absolute: `${org.name} · Agende seu horário` },
    description: org.description.slice(0, 160) || `Agende online com ${org.name}.`,
    openGraph: { title: `${org.name} · Agende seu horário`, description: org.description.slice(0, 160), images: org.coverUrl ? [org.coverUrl] : org.logoUrl ? [org.logoUrl] : [] },
  };
}

const WD = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default async function PublicPage({ params }: Props) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug.toLowerCase());
  if (!org) notFound();
  const settings = orgSettings(org);
  const [services, pros, links, hours] = await Promise.all([
    db.select().from(schema.services)
      .where(and(eq(schema.services.organizationId, org.id), eq(schema.services.active, true), eq(schema.services.onlineVisible, true)))
      .orderBy(asc(schema.services.sortOrder), asc(schema.services.name)),
    db.select().from(schema.professionals)
      .where(and(eq(schema.professionals.organizationId, org.id), eq(schema.professionals.active, true), eq(schema.professionals.acceptsOnline, true)))
      .orderBy(asc(schema.professionals.sortOrder), asc(schema.professionals.name)),
    db.select().from(schema.professionalServices).where(eq(schema.professionalServices.organizationId, org.id)),
    db.select().from(schema.businessHours).where(eq(schema.businessHours.organizationId, org.id)),
  ]);
  const proIds = new Set(pros.map((p) => p.id));
  const bookable = services
    .map((s) => ({ ...s, professionalIds: links.filter((l) => l.serviceId === s.id && proIds.has(l.professionalId)).map((l) => l.professionalId) }))
    .filter((s) => s.professionalIds.length > 0);

  const hoursByDay = [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const list = hours.filter((h) => h.weekday === wd).sort((a, b) => a.startMinute - b.startMinute);
    return { wd, text: list.length ? list.map((h) => `${minutesToHHMM(h.startMinute)}–${minutesToHHMM(h.endMinute)}`).join(" · ") : "Fechado" };
  });
  const contactPhone = org.whatsapp || org.phone;

  return (
    <div className="min-h-dvh">
      <header className="relative overflow-hidden border-b border-line">
        <div
          className="absolute inset-0"
          style={org.coverUrl
            ? { backgroundImage: `linear-gradient(to bottom, rgb(43 29 36 / .15), rgb(251 247 244 / 1)), url("${org.coverUrl.replace(/["\\\n\r()]/g, encodeURIComponent)}")`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "radial-gradient(120% 90% at 85% -10%, #f1dbe3 0%, rgba(241,219,227,0) 60%), radial-gradient(90% 80% at 0% 0%, #f6eadf 0%, rgba(246,234,223,0) 55%)" }}
        />
        <div className="relative mx-auto max-w-3xl px-5 pb-8 pt-10 sm:pt-14">
          <div className="flex items-center gap-4">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="size-16 rounded-full border-2 border-white object-cover shadow-sm sm:size-20" />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full border border-berry/20 bg-white font-display text-2xl text-berry shadow-sm sm:size-20 sm:text-3xl">
                {org.name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-display text-3xl leading-tight sm:text-4xl">{org.name}</h1>
              {org.address && <p className="mt-1 flex items-center gap-1 text-sm text-ink-2"><MapPin size={14} /> {org.address}</p>}
            </div>
          </div>
          {org.description && <p className="mt-5 max-w-xl whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{org.description}</p>}
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            {contactPhone && (
              <a href={whatsappLink(contactPhone, `Olá! Vim pela página de agendamento da ${org.name}.`)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-white px-3.5 py-2">
                <MessageCircle size={15} className="text-ok" /> WhatsApp
              </a>
            )}
            {org.phone && (
              <a href={`tel:+${org.phone.replace(/\D/g, "").replace(/^(?!55)/, "55")}`} className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-white px-3.5 py-2">
                <Phone size={15} /> {formatPhone(org.phone)}
              </a>
            )}
            {org.instagram && (
              <a href={`https://instagram.com/${org.instagram}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-white px-3.5 py-2">
                <AtSign size={15} /> @{org.instagram}
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        {org.onlineBookingEnabled && bookable.length > 0 ? (
          <BookingWizard
            slug={org.slug}
            today={toLocalDate(new Date(), org.timezone)}
            requireEmail={settings.requireEmail}
            policyText={settings.policyText}
            address={org.address}
            orgName={org.name}
            services={bookable.map((s) => ({
              id: s.id, name: s.name, category: s.category, description: s.description, durationMinutes: s.durationMinutes,
              priceCents: s.priceCents, priceFrom: s.priceFrom, professionalIds: s.professionalIds,
            }))}
            professionals={pros.map((p) => ({ id: p.id, name: p.name, bio: p.bio, photoUrl: p.photoUrl }))}
          />
        ) : (
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-center shadow-[var(--shadow-soft)]">
            <h2 className="font-display text-2xl">Agendamentos pelo WhatsApp</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">No momento os horários são marcados diretamente com a gente. Fale pelo WhatsApp que encontramos o melhor horário para você.</p>
            {contactPhone && (
              <a href={whatsappLink(contactPhone, "Olá! Gostaria de agendar um horário.")} target="_blank" rel="noopener"
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-berry px-6 font-medium text-white">
                <MessageCircle size={18} /> Chamar no WhatsApp
              </a>
            )}
            {services.length > 0 && (
              <ul className="mt-8 divide-y divide-line text-left">
                {services.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3 py-3 text-sm"><span>{s.name}</span><span className="text-muted tnum">{s.priceFrom ? "a partir de " : ""}{(s.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></li>
                ))}
              </ul>
            )}
          </div>
        )}

        <section className="mt-12 grid gap-8 border-t border-line pt-8 sm:grid-cols-2">
          {hours.length > 0 && (
            <div>
              <h2 className="font-display text-xl">Horário de funcionamento</h2>
              <dl className="mt-3 space-y-1.5 text-sm">
                {hoursByDay.map((d) => (
                  <div key={d.wd} className="flex justify-between gap-4"><dt className="text-ink-2">{WD[d.wd]}</dt><dd className={d.text === "Fechado" ? "text-muted" : "tnum"}>{d.text}</dd></div>
                ))}
              </dl>
            </div>
          )}
          {settings.policyText && (
            <div>
              <h2 className="font-display text-xl">Políticas</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-2">{settings.policyText}</p>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        <Link href={`/${org.slug}/meu-agendamento`} className="underline-offset-4 hover:underline">Encontrar meu agendamento</Link>
        <span className="mx-2">·</span>
        <Link href="/termos" className="underline-offset-4 hover:underline">Termos de uso</Link>
        <span className="mx-2">·</span>
        <Link href="/privacidade" className="underline-offset-4 hover:underline">Privacidade</Link>
      </footer>
    </div>
  );
}
