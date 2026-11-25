import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { BookingError, createOnlineBooking, getOrgBySlug, orgSettings } from "@/lib/booking";
import { isValidBrPhone } from "@/lib/security";
import { manageUrl, notifyAppointment } from "@/lib/notify";
import { fmtLongDate, fmtTime } from "@/lib/time";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const bodySchema = z.object({
  serviceId: z.uuid(),
  professionalId: z.union([z.uuid(), z.literal("any")]),
  startsAt: z.iso.datetime(),
  name: z.string().trim().min(2, "Informe seu nome completo.").max(120),
  phone: z.string().trim().refine(isValidBrPhone, "Informe um WhatsApp válido com DDD."),
  email: z.union([z.email("E-mail inválido."), z.literal("")]),
  notes: z.string().trim().max(500).default(""),
  acceptTerms: z.literal(true, { error: "É preciso aceitar os termos e a política de privacidade." }),
  marketingConsent: z.boolean().default(false),
  idempotencyKey: z.string().min(8).max(80),
  website: z.string().max(0).optional(), // honeypot anti-robô
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return NextResponse.json({ error: "Negócio não encontrado." }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;
  const settings = orgSettings(org);
  if (settings.requireEmail && !d.email) return NextResponse.json({ error: "Informe seu e-mail para receber a confirmação." }, { status: 400 });

  try {
    const { appointment, manageToken, duplicate } = await createOnlineBooking({
      org,
      serviceId: d.serviceId,
      professionalId: d.professionalId,
      startsAt: new Date(d.startsAt),
      client: { name: d.name, phone: d.phone, email: d.email, notes: d.notes, marketingConsent: d.marketingConsent },
      idempotencyKey: `web:${d.idempotencyKey}`,
    });
    if (!duplicate) {
      after(async () => {
        await notifyAppointment({ appointmentId: appointment.id, key: appointment.status === "confirmed" ? "booking_confirmed_client" : "booking_pending_client", manageToken });
        await notifyAppointment({ appointmentId: appointment.id, key: "booking_new_business" });
      });
    }
    const [prof] = await db.select({ name: schema.professionals.name }).from(schema.professionals).where(eq(schema.professionals.id, appointment.professionalId));
    return NextResponse.json({
      code: appointment.code,
      status: appointment.status,
      service: appointment.serviceName,
      professional: prof?.name ?? "",
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      dateLabel: fmtLongDate(appointment.startsAt, org.timezone),
      timeLabel: fmtTime(appointment.startsAt, org.timezone),
      manageUrl: manageToken ? manageUrl(org.slug, appointment.code, manageToken) : null,
    });
  } catch (e) {
    if (e instanceof BookingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "slot_taken" ? 409 : 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Não foi possível concluir agora. Tente novamente em instantes." }, { status: 500 });
  }
}
