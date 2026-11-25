/**
 * Testes de integração com Postgres real.
 * Rodar: npm run test:integration (usa TEST_DATABASE_URL, padrão postgres://postgres@localhost:5432/agenda_test)
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  BookingError,
  changeStatus,
  createOnlineBooking,
  createPanelAppointment,
  findBlockConflicts,
  getAppointmentByToken,
  publicAvailability,
  rescheduleAppointment,
} from "@/lib/booking";
import { createOrganization } from "@/lib/org-setup";
import { addDays, localToUtc, toLocalDate } from "@/lib/time";

const TZ = "America/Sao_Paulo";
let org: typeof schema.organizations.$inferSelect;
let serviceId: string;
let profId: string;
let date: string;

function nextWeekday(weekday: number) {
  let d = addDays(toLocalDate(new Date(), TZ), 2);
  while (new Date(d + "T12:00:00Z").getUTCDay() !== weekday) d = addDays(d, 1);
  return d;
}

beforeAll(async () => {
  const [user] = await db.insert(schema.users).values({ name: "Tatiane", email: `t${Date.now()}@teste.dev`, passwordHash: "x" }).returning();
  org = await createOrganization({
    ownerUserId: user.id, ownerName: "Tatiane", ownerEmail: user.email, name: "Tatiane By Lash Teste",
    segment: "lash", phone: "11999999999", address: "", withSuggestedServices: true,
  });
  const [svc] = await db.select().from(schema.services).where(eq(schema.services.organizationId, org.id)).limit(1);
  serviceId = svc.id; // fio a fio, 120 min + 15 min
  const [p] = await db.select().from(schema.professionals).where(eq(schema.professionals.organizationId, org.id));
  profId = p.id;
  date = nextWeekday(3); // quarta-feira
});

const client = (n: number) => ({ name: `Cliente ${n}`, phone: `1198888${String(n).padStart(4, "0")}`, email: "", notes: "", marketingConsent: false });

describe("reserva online", () => {
  it("o mesmo horário não pode ser reservado duas vezes, mesmo em pedidos simultâneos", async () => {
    const start = localToUtc(date, 9 * 60, TZ);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        createOnlineBooking({ org, serviceId, professionalId: profId, startsAt: start, client: client(i), idempotencyKey: `race-${i}` }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed.every((f) => f.reason instanceof BookingError && f.reason.code === "slot_taken")).toBe(true);

    const rows = await db.select().from(schema.appointments).where(eq(schema.appointments.organizationId, org.id));
    expect(rows.filter((r) => r.startsAt.getTime() === start.getTime())).toHaveLength(1);
  });

  it("a reserva feita some da disponibilidade pública (incluindo o intervalo pós-atendimento)", async () => {
    const avail = await publicAvailability({ org, serviceId, professionalId: profId, fromDate: date, days: 1 });
    const times = avail[0].slots.map((s) => s.start.getTime());
    expect(times).not.toContain(localToUtc(date, 9 * 60, TZ).getTime());
    expect(times).not.toContain(localToUtc(date, 10 * 60 + 30, TZ).getTime()); // 9:00–11:00 + 15 min
  });

  it("reenvio com a mesma chave de idempotência não cria outro agendamento", async () => {
    const start = localToUtc(date, 16 * 60, TZ);
    const a = await createOnlineBooking({ org, serviceId, professionalId: profId, startsAt: start, client: client(50), idempotencyKey: "same-key" });
    const b = await createOnlineBooking({ org, serviceId, professionalId: profId, startsAt: start, client: client(50), idempotencyKey: "same-key" });
    expect(b.appointment.id).toBe(a.appointment.id);
    expect(b.duplicate).toBe(true);
  });

  it("rejeita horário fora do expediente e com antecedência insuficiente", async () => {
    await expect(
      createOnlineBooking({ org, serviceId, professionalId: profId, startsAt: localToUtc(date, 7 * 60, TZ), client: client(60), idempotencyKey: "early" }),
    ).rejects.toMatchObject({ code: "slot_taken" });
    const soon = new Date(Date.now() + 30 * 60000);
    await expect(
      createOnlineBooking({ org, serviceId, professionalId: profId, startsAt: soon, client: client(61), idempotencyKey: "soon" }),
    ).rejects.toMatchObject({ code: "slot_taken" });
  });
});

describe("bloqueios", () => {
  it("bloqueio tira o horário do site e detecta conflito com reservas existentes", async () => {
    const startsAt = localToUtc(date, 13 * 60, TZ);
    const endsAt = localToUtc(date, 15 * 60, TZ);
    await db.insert(schema.availabilityBlocks).values({ organizationId: org.id, professionalId: profId, title: "Dentista", kind: "personal", startsAt, endsAt });
    const avail = await publicAvailability({ org, serviceId, professionalId: profId, fromDate: date, days: 1 });
    const times = avail[0].slots.map((s) => s.start.getTime());
    expect(times).not.toContain(localToUtc(date, 13 * 60, TZ).getTime());
    expect(times).not.toContain(localToUtc(date, 14 * 60, TZ).getTime());

    const conflicts = await findBlockConflicts({
      orgId: org.id, tz: TZ, professionalId: profId,
      startsAt: localToUtc(date, 8 * 60, TZ), endsAt: localToUtc(date, 10 * 60, TZ), recurrence: "none", recurrenceUntil: null,
    });
    expect(conflicts).toHaveLength(1);
  });

  it("o painel não consegue agendar em cima de um bloqueio", async () => {
    const [c] = await db.select().from(schema.clients).where(eq(schema.clients.organizationId, org.id)).limit(1);
    await expect(
      createPanelAppointment({
        orgId: org.id, tz: TZ, clientId: c.id, serviceId, professionalId: profId, startsAt: localToUtc(date, 13 * 60, TZ),
        status: "confirmed", allowOutsideHours: false, actor: { type: "user", label: "teste", source: "panel" },
      }),
    ).rejects.toMatchObject({ code: "blocked" });
  });
});

describe("cancelamento e reagendamento", () => {
  it("cancelar libera o horário e reativar só funciona se ele estiver livre", async () => {
    const start = localToUtc(addDays(date, 1), 9 * 60, TZ); // quinta
    const { appointment } = await createOnlineBooking({ org, serviceId, professionalId: profId, startsAt: start, client: client(70), idempotencyKey: "cancel-1" });
    await changeStatus({ orgId: org.id, appointmentId: appointment.id, status: "cancelled_by_client", actor: { type: "client", label: "c", source: "online" } });
    const second = await createOnlineBooking({ org, serviceId, professionalId: profId, startsAt: start, client: client(71), idempotencyKey: "cancel-2" });
    expect(second.appointment.startsAt.getTime()).toBe(start.getTime());
    await expect(
      changeStatus({ orgId: org.id, appointmentId: appointment.id, status: "confirmed", actor: { type: "user", label: "u", source: "panel" } }),
    ).rejects.toMatchObject({ code: "slot_taken" });
    const events = await db.select().from(schema.appointmentEvents).where(eq(schema.appointmentEvents.appointmentId, appointment.id));
    expect(events.map((e) => e.action)).toEqual(expect.arrayContaining(["created", "cancelled"]));
  });

  it("reagendamento pela cliente respeita a disponibilidade e mantém o link", async () => {
    const start = localToUtc(addDays(date, 1), 14 * 60, TZ);
    const { appointment, manageToken } = await createOnlineBooking({ org, serviceId, professionalId: profId, startsAt: start, client: client(80), idempotencyKey: "resched" });
    const target = localToUtc(addDays(date, 1), 16 * 60 + 30, TZ);
    const updated = await rescheduleAppointment({
      orgId: org.id, appointmentId: appointment.id, startsAt: target, mode: "client", actor: { type: "client", label: "c", source: "online" },
    });
    expect(updated.startsAt.getTime()).toBe(target.getTime());
    const viaLink = await getAppointmentByToken(org.id, appointment.code, manageToken!);
    expect(viaLink?.appt.startsAt.getTime()).toBe(target.getTime());
    expect(await getAppointmentByToken(org.id, appointment.code, "token-errado")).toBeNull();
    // não pode reagendar para cima de outra reserva (9:00 de quinta está ocupado)
    await expect(
      rescheduleAppointment({ orgId: org.id, appointmentId: appointment.id, startsAt: localToUtc(addDays(date, 1), 9 * 60, TZ), mode: "client", actor: { type: "client", label: "c", source: "online" } }),
    ).rejects.toMatchObject({ code: "slot_taken" });
  });
});

describe("isolamento entre empresas", () => {
  it("uma empresa não acessa agendamentos de outra", async () => {
    const [user] = await db.insert(schema.users).values({ name: "Outra", email: `o${Date.now()}@teste.dev`, passwordHash: "x" }).returning();
    const other = await createOrganization({
      ownerUserId: user.id, ownerName: "Outra", ownerEmail: user.email, name: "Outra Empresa",
      segment: "outro", phone: "", address: "", withSuggestedServices: true,
    });
    const [appt] = await db.select().from(schema.appointments).where(eq(schema.appointments.organizationId, org.id)).limit(1);
    await expect(
      changeStatus({ orgId: other.id, appointmentId: appt.id, status: "cancelled_by_business", actor: { type: "user", label: "x", source: "panel" } }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(publicAvailability({ org: other, serviceId, professionalId: "any", fromDate: date, days: 1 })).rejects.toMatchObject({ code: "not_found" });
  });
});
