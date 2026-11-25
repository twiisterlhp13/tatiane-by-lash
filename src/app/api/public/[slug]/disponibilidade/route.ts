import { NextResponse, type NextRequest } from "next/server";
import { BookingError, getOrgBySlug, publicAvailability } from "@/lib/booking";
import { fmtTime, isValidLocalDate, toLocalDate } from "@/lib/time";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org || !org.onlineBookingEnabled) return NextResponse.json({ error: "Agendamento online indisponível." }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const serviceId = sp.get("service") ?? "";
  const prof = sp.get("prof") || "any";
  const from = sp.get("from") || toLocalDate(new Date(), org.timezone);
  const days = Math.min(Number(sp.get("days") || 14), 31);
  const exclude = sp.get("exclude") || undefined; // reagendamento: ignora o próprio horário
  if (!/^[0-9a-f-]{36}$/.test(serviceId) || (prof !== "any" && !/^[0-9a-f-]{36}$/.test(prof)) || !isValidLocalDate(from)) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }
  const today = toLocalDate(new Date(), org.timezone);
  try {
    const result = await publicAvailability({
      org, serviceId, professionalId: prof, fromDate: from < today ? today : from, days,
      excludeAppointmentId: exclude && /^[0-9a-f-]{36}$/.test(exclude) ? exclude : undefined,
    });
    return NextResponse.json(
      {
        days: result.map((d) => ({
          date: d.date,
          slots: d.slots.map((s) => ({ start: s.start.toISOString(), time: fmtTime(s.start, org.timezone), professionalIds: s.professionalIds })),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
