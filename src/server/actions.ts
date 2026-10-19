import type { PoolClient } from "pg";
import { z } from "zod";
import { tx } from "./db";

/**
 * Las mismas acciones que usa el almacén del navegador (src/lib/store.tsx), validadas y aplicadas en la base.
 * Toda fila se comprueba contra el dueño: un usuario nunca puede tocar datos de otro.
 */

export class ActionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const uuid = z.string().uuid();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d && y >= 1990;
  }, "Fecha inválida");

/** Hoy en cualquier huso horario puede ser hasta un día posterior al de UTC. */
const notFuture = (s: string) => s <= new Date(Date.now() + 36 * 3_600_000).toISOString().slice(0, 10);
const pastDate = isoDate.refine(notFuture, "La fecha no puede estar en el futuro");

const num = (min: number, max: number) => z.number().finite().min(min).max(max);
const sex = z.enum(["female", "male", "unspecified"]);
const tone = z.enum(["moss", "sage", "terracotta", "sand"]);
const blood = z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"]);

const childFields = {
  name: z.string().trim().min(1).max(60),
  birthDate: pastDate,
  sex,
  tone,
  bloodType: blood,
  allergies: z.array(z.string().trim().min(1).max(60)).max(30),
  notes: z.string().max(500),
  birthWeightKg: num(0.3, 10).nullable(),
  birthLengthCm: num(20, 70).nullable(),
  birthHeadCm: num(15, 50).nullable(),
};

const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("addChild"), child: z.object({ id: uuid, ...childFields }) }),
  z.object({ type: z.literal("updateChild"), id: uuid, patch: z.object(childFields).partial().strict() }),
  z.object({ type: z.literal("removeChild"), id: uuid }),
  z.object({
    type: z.literal("addMeasurement"),
    m: z.object({
      id: uuid,
      childId: uuid,
      measuredAt: pastDate,
      weightKg: num(0.3, 250).nullable(),
      heightCm: num(20, 230).nullable(),
      headCm: num(15, 70).nullable(),
      note: z.string().max(120),
    }),
  }),
  z.object({ type: z.literal("removeMeasurement"), id: uuid }),
  z.object({
    type: z.literal("saveVaccine"),
    record: z.object({ childId: uuid, vaccineId: z.string().min(1).max(40), appliedAt: pastDate, lot: z.string().max(40), place: z.string().max(60) }),
  }),
  z.object({ type: z.literal("clearVaccine"), childId: uuid, vaccineId: z.string().min(1).max(40) }),
  z.object({ type: z.literal("setMilestone"), childId: uuid, milestoneId: z.string().min(1).max(40), achievedAt: pastDate.nullable() }),
  z.object({
    type: z.literal("addJournal"),
    entry: z.object({
      id: uuid,
      childId: uuid,
      kind: z.enum(["sonrisa", "volteo", "palabra", "pasos", "diente", "escuela", "otro"]),
      title: z.string().trim().min(1).max(120),
      occurredAt: pastDate,
      note: z.string().max(600),
    }),
  }),
  z.object({ type: z.literal("removeJournal"), id: uuid }),
]);

export type ServerAction = z.infer<typeof action>;

export function parseAction(input: unknown): ServerAction {
  const r = action.safeParse(input);
  if (!r.success) throw new ActionError(400, "Datos inválidos.");
  return r.data;
}

async function assertOwnsChild(c: PoolClient, userId: string, childId: string) {
  const { rowCount } = await c.query(`select 1 from public.children where id = $1 and owner_id = $2`, [childId, userId]);
  if (!rowCount) throw new ActionError(404, "No encontrado.");
}

const FIELD_COLUMNS: Record<string, string> = {
  name: "name",
  birthDate: "birth_date",
  sex: "sex",
  tone: "tone",
  bloodType: "blood_type",
  allergies: "allergies",
  notes: "notes",
  birthWeightKg: "birth_weight_kg",
  birthLengthCm: "birth_length_cm",
  birthHeadCm: "birth_head_cm",
};

export async function applyAction(userId: string, raw: unknown): Promise<void> {
  const a = parseAction(raw);

  await tx(async (c) => {
    switch (a.type) {
      case "addChild": {
        const ch = a.child;
        const r = await c.query(
          `insert into public.children (id, owner_id, name, birth_date, sex, tone, blood_type, allergies, notes,
                                        birth_weight_kg, birth_length_cm, birth_head_cm)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict (id) do nothing`,
          [ch.id, userId, ch.name, ch.birthDate, ch.sex, ch.tone, ch.bloodType, ch.allergies, ch.notes, ch.birthWeightKg, ch.birthLengthCm, ch.birthHeadCm],
        );
        // Repetir la misma acción (reintento) es inofensivo; un id ajeno no.
        if (!r.rowCount) await assertOwnsChild(c, userId, ch.id);
        return;
      }
      case "updateChild": {
        const entries = Object.entries(a.patch).filter(([, v]) => v !== undefined);
        if (!entries.length) return;
        const sets = entries.map(([k], i) => `${FIELD_COLUMNS[k]} = $${i + 3}`);
        const r = await c.query(`update public.children set ${sets.join(", ")} where id = $1 and owner_id = $2`, [a.id, userId, ...entries.map(([, v]) => v)]);
        if (!r.rowCount) throw new ActionError(404, "No encontrado.");
        return;
      }
      case "removeChild": {
        await c.query(`delete from public.children where id = $1 and owner_id = $2`, [a.id, userId]);
        return;
      }
      case "addMeasurement": {
        const m = a.m;
        if (m.weightKg === null && m.heightCm === null && m.headCm === null) throw new ActionError(400, "Datos inválidos.");
        await assertOwnsChild(c, userId, m.childId);
        await c.query(
          `insert into public.measurements (id, child_id, measured_at, weight_kg, height_cm, head_cm, note, source)
           values ($1,$2,$3,$4,$5,$6,$7,'manual') on conflict (id) do nothing`,
          [m.id, m.childId, m.measuredAt, m.weightKg, m.heightCm, m.headCm, m.note],
        );
        return;
      }
      case "removeMeasurement": {
        // La medición de nacimiento se edita desde la ficha, no se borra.
        await c.query(
          `delete from public.measurements m using public.children ch
            where m.id = $1 and m.source = 'manual' and ch.id = m.child_id and ch.owner_id = $2`,
          [a.id, userId],
        );
        return;
      }
      case "saveVaccine": {
        const r = a.record;
        await assertOwnsChild(c, userId, r.childId);
        const ok = await c.query(`select 1 from public.vaccines where id = $1`, [r.vaccineId]);
        if (!ok.rowCount) throw new ActionError(400, "Datos inválidos.");
        await c.query(
          `insert into public.child_vaccines (child_id, vaccine_id, applied_at, lot, place) values ($1,$2,$3,$4,$5)
           on conflict (child_id, vaccine_id) do update set applied_at = excluded.applied_at, lot = excluded.lot, place = excluded.place`,
          [r.childId, r.vaccineId, r.appliedAt, r.lot, r.place],
        );
        return;
      }
      case "clearVaccine": {
        await assertOwnsChild(c, userId, a.childId);
        await c.query(`delete from public.child_vaccines where child_id = $1 and vaccine_id = $2`, [a.childId, a.vaccineId]);
        return;
      }
      case "setMilestone": {
        await assertOwnsChild(c, userId, a.childId);
        if (a.achievedAt === null) {
          await c.query(`delete from public.child_milestones where child_id = $1 and milestone_id = $2`, [a.childId, a.milestoneId]);
          return;
        }
        const ok = await c.query(`select 1 from public.milestones where id = $1`, [a.milestoneId]);
        if (!ok.rowCount) throw new ActionError(400, "Datos inválidos.");
        await c.query(
          `insert into public.child_milestones (child_id, milestone_id, achieved_at) values ($1,$2,$3)
           on conflict (child_id, milestone_id) do update set achieved_at = excluded.achieved_at`,
          [a.childId, a.milestoneId, a.achievedAt],
        );
        return;
      }
      case "addJournal": {
        const e = a.entry;
        await assertOwnsChild(c, userId, e.childId);
        await c.query(
          `insert into public.journal_entries (id, child_id, kind, title, occurred_at, note) values ($1,$2,$3,$4,$5,$6)
           on conflict (id) do nothing`,
          [e.id, e.childId, e.kind, e.title, e.occurredAt, e.note],
        );
        return;
      }
      case "removeJournal": {
        await c.query(
          `delete from public.journal_entries j using public.children ch where j.id = $1 and ch.id = j.child_id and ch.owner_id = $2`,
          [a.id, userId],
        );
        return;
      }
    }
  });
}
