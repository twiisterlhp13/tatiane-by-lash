"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireCtx, type Ctx } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { hhmmToMinutes, isValidLocalDate } from "@/lib/time";

export type Result = { ok: true } | { ok: false; error: string };

async function assertProfessional(ctx: Ctx, professionalId: string) {
  const [p] = await db.select().from(schema.professionals)
    .where(and(eq(schema.professionals.id, professionalId), eq(schema.professionals.organizationId, ctx.org.id))).limit(1);
  if (!p) throw new Error("Profissional não encontrada.");
  if (!ctx.can("hours.manage") && ctx.professionalId !== professionalId) throw new Error("Você só pode alterar o seu próprio horário.");
  return p;
}

const daySchema = z.object({ weekday: z.number().int().min(0).max(6), intervals: z.array(z.object({ start: z.string(), end: z.string() })).max(4) });

export async function saveWeeklyHoursAction(input: { professionalId: string; days: z.input<typeof daySchema>[]; alsoBusinessHours: boolean; applyToAll: boolean }): Promise<Result> {
  try {
    const ctx = await requireCtx();
    await assertProfessional(ctx, input.professionalId);
    const days = z.array(daySchema).parse(input.days);
    const rows: { weekday: number; startMinute: number; endMinute: number }[] = [];
    for (const d of days) {
      const ints = d.intervals
        .map((i) => ({ s: hhmmToMinutes(i.start), e: hhmmToMinutes(i.end) }))
        .sort((a, b) => (a.s ?? 0) - (b.s ?? 0));
      for (let k = 0; k < ints.length; k++) {
        const { s, e } = ints[k];
        if (s === null || e === null || e <= s) return { ok: false, error: "Confira os horários: o fim precisa ser depois do início." };
        if (k > 0 && s < ints[k - 1].e!) return { ok: false, error: "Os intervalos de um mesmo dia não podem se sobrepor." };
        rows.push({ weekday: d.weekday, startMinute: s, endMinute: e });
      }
    }
    const targets = input.applyToAll && ctx.can("hours.manage")
      ? (await db.select({ id: schema.professionals.id }).from(schema.professionals).where(eq(schema.professionals.organizationId, ctx.org.id))).map((p) => p.id)
      : [input.professionalId];
    await db.transaction(async (tx) => {
      for (const pid of targets) {
        await tx.delete(schema.professionalHours).where(and(eq(schema.professionalHours.professionalId, pid), eq(schema.professionalHours.organizationId, ctx.org.id)));
        if (rows.length) await tx.insert(schema.professionalHours).values(rows.map((r) => ({ ...r, organizationId: ctx.org.id, professionalId: pid })));
      }
      if (input.alsoBusinessHours && ctx.can("hours.manage")) {
        await tx.delete(schema.businessHours).where(eq(schema.businessHours.organizationId, ctx.org.id));
        if (rows.length) await tx.insert(schema.businessHours).values(rows.map((r) => ({ ...r, organizationId: ctx.org.id })));
      }
    });
    await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "hours.updated", entity: "professional", entityId: input.professionalId, data: { rows, applyToAll: input.applyToAll } });
    revalidatePath("/painel/horarios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function addSpecialHourAction(input: { professionalId: string; date: string; closed: boolean; start: string; end: string; note: string }): Promise<Result> {
  try {
    const ctx = await requireCtx();
    await assertProfessional(ctx, input.professionalId);
    if (!isValidLocalDate(input.date)) return { ok: false, error: "Data inválida." };
    const s = input.closed ? 0 : hhmmToMinutes(input.start);
    const e = input.closed ? 0 : hhmmToMinutes(input.end);
    if (s === null || e === null || (!input.closed && e <= s)) return { ok: false, error: "Confira o horário." };
    await db.insert(schema.specialHours).values({ organizationId: ctx.org.id, professionalId: input.professionalId, date: input.date, startMinute: s, endMinute: e, note: input.note.slice(0, 200) });
    await audit({ organizationId: ctx.org.id, userId: ctx.user.id, actorLabel: ctx.user.name, action: "special_hours.created", entity: "professional", entityId: input.professionalId, data: input });
    revalidatePath("/painel/horarios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteSpecialHourAction(id: string): Promise<Result> {
  try {
    const ctx = await requireCtx();
    const [row] = await db.select().from(schema.specialHours).where(and(eq(schema.specialHours.id, id), eq(schema.specialHours.organizationId, ctx.org.id))).limit(1);
    if (!row) return { ok: false, error: "Não encontrado." };
    await assertProfessional(ctx, row.professionalId);
    await db.delete(schema.specialHours).where(eq(schema.specialHours.id, id));
    revalidatePath("/painel/horarios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
