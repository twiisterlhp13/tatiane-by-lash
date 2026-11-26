import "server-only";
import { eq } from "drizzle-orm";
import { db, schema, type Tx } from "@/db";
import { defaultOrgSettings } from "@/db/schema";
import { RESERVED_SLUGS, slugify } from "./security";

export const DEFAULT_HOURS: { weekday: number; startMinute: number; endMinute: number }[] = [
  ...[1, 2, 3, 4, 5].flatMap((d) => [
    { weekday: d, startMinute: 9 * 60, endMinute: 12 * 60 },
    { weekday: d, startMinute: 13 * 60, endMinute: 19 * 60 },
  ]),
  { weekday: 6, startMinute: 9 * 60, endMinute: 15 * 60 },
];

/** Sugestões de serviços por segmento. A dona edita preços e durações no onboarding. */
export const SUGGESTED_SERVICES: Record<string, { name: string; category: string; description: string; durationMinutes: number; bufferMinutes: number; priceCents: number; priceFrom?: boolean }[]> = {
  lash: [
    { name: "Extensão de cílios – Fio a fio", category: "Extensão de cílios", description: "Efeito natural, um fio aplicado em cada cílio.", durationMinutes: 120, bufferMinutes: 15, priceCents: 18000 },
    { name: "Extensão de cílios – Volume brasileiro", category: "Extensão de cílios", description: "Mais preenchimento com fios em formato Y.", durationMinutes: 120, bufferMinutes: 15, priceCents: 20000 },
    { name: "Extensão de cílios – Volume russo", category: "Extensão de cílios", description: "Leques de fios ultrafinos para um olhar marcante.", durationMinutes: 150, bufferMinutes: 15, priceCents: 25000 },
    { name: "Manutenção de extensão", category: "Manutenção", description: "Reposição dos fios em até 21 dias da aplicação.", durationMinutes: 90, bufferMinutes: 15, priceCents: 12000, priceFrom: true },
    { name: "Lash lifting", category: "Cílios naturais", description: "Curvatura e tintura dos cílios naturais.", durationMinutes: 60, bufferMinutes: 10, priceCents: 12000 },
    { name: "Design de sobrancelhas", category: "Sobrancelhas", description: "Modelagem com pinça respeitando o formato do rosto.", durationMinutes: 30, bufferMinutes: 5, priceCents: 5000 },
    { name: "Remoção de extensão", category: "Manutenção", description: "Remoção segura, sem danificar os cílios naturais.", durationMinutes: 30, bufferMinutes: 5, priceCents: 4000 },
  ],
  beleza: [
    { name: "Corte feminino", category: "Cabelo", description: "", durationMinutes: 60, bufferMinutes: 10, priceCents: 8000, priceFrom: true },
    { name: "Escova", category: "Cabelo", description: "", durationMinutes: 45, bufferMinutes: 10, priceCents: 5000 },
    { name: "Manicure", category: "Unhas", description: "", durationMinutes: 45, bufferMinutes: 5, priceCents: 3500 },
  ],
  outro: [{ name: "Atendimento", category: "", description: "", durationMinutes: 60, bufferMinutes: 0, priceCents: 0 }],
};

export const SEGMENTS: { value: string; label: string }[] = [
  { value: "lash", label: "Cílios e sobrancelhas" },
  { value: "beleza", label: "Salão de beleza" },
  { value: "estetica", label: "Estética" },
  { value: "saude", label: "Saúde e terapias" },
  { value: "fitness", label: "Fitness" },
  { value: "educacao", label: "Aulas e educação" },
  { value: "outro", label: "Outro" },
];

export async function availableSlug(base: string, q: typeof db | Tx = db) {
  let root = slugify(base) || "minha-agenda";
  if (RESERVED_SLUGS.has(root)) root = `${root}-agenda`;
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const [hit] = await q.select({ id: schema.organizations.id }).from(schema.organizations).where(eq(schema.organizations.slug, candidate)).limit(1);
    const [alias] = await q.select({ s: schema.organizationSlugAliases.slug }).from(schema.organizationSlugAliases).where(eq(schema.organizationSlugAliases.slug, candidate)).limit(1);
    if (!hit && !alias) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function createOrganization(args: {
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  name: string;
  segment: string;
  phone: string;
  address: string;
  withSuggestedServices: boolean;
}) {
  return db.transaction(async (tx) => {
    const slug = await availableSlug(args.name, tx);
    const [org] = await tx.insert(schema.organizations).values({
      name: args.name,
      slug,
      segment: args.segment,
      phone: args.phone,
      whatsapp: args.phone,
      email: args.ownerEmail,
      address: args.address,
      settings: { ...defaultOrgSettings, notifyBusinessEmail: args.ownerEmail },
    }).returning();

    const [prof] = await tx.insert(schema.professionals).values({
      organizationId: org.id,
      name: args.ownerName,
      email: args.ownerEmail,
    }).returning();

    await tx.insert(schema.organizationMembers).values({
      organizationId: org.id,
      userId: args.ownerUserId,
      role: "owner",
      professionalId: prof.id,
    });

    await tx.insert(schema.businessHours).values(DEFAULT_HOURS.map((h) => ({ ...h, organizationId: org.id })));
    await tx.insert(schema.professionalHours).values(DEFAULT_HOURS.map((h) => ({ ...h, organizationId: org.id, professionalId: prof.id })));

    if (args.withSuggestedServices) {
      const list = SUGGESTED_SERVICES[args.segment] ?? SUGGESTED_SERVICES.outro;
      const created = await tx.insert(schema.services).values(
        list.map((s, i) => ({ ...s, priceFrom: s.priceFrom ?? false, organizationId: org.id, sortOrder: i })),
      ).returning({ id: schema.services.id });
      await tx.insert(schema.professionalServices).values(
        created.map((s) => ({ organizationId: org.id, professionalId: prof.id, serviceId: s.id })),
      );
    }

    await tx.insert(schema.auditLogs).values({
      organizationId: org.id,
      userId: args.ownerUserId,
      actorLabel: args.ownerName,
      action: "organization.created",
      entity: "organization",
      entityId: org.id,
    });
    return org;
  });
}
