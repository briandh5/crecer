import type { DataState } from "@/lib/demo";
import type { BloodType, Child, JournalEntry, JournalKind, Measurement, Sex, Tone } from "@/lib/types";
import { query } from "./db";

interface ChildRow {
  id: string; name: string; birth_date: string; sex: Sex; tone: Tone; blood_type: BloodType; allergies: string[]; notes: string;
  birth_weight_kg: number | null; birth_length_cm: number | null; birth_head_cm: number | null;
}
interface MeasurementRow {
  id: string; child_id: string; measured_at: string; weight_kg: number | null; height_cm: number | null; head_cm: number | null;
  note: string; source: "birth" | "manual";
}
interface JournalRow {
  id: string; child_id: string; kind: JournalKind; title: string; occurred_at: string; note: string; has_photo: boolean;
}

/** Todos los datos de una cuenta, con la forma que usa la app en el navegador. */
export async function loadState(userId: string): Promise<DataState> {
  const [children, measurements, vaccines, milestones, journal] = await Promise.all([
    query<ChildRow>(
      `select id, name, birth_date, sex, tone, blood_type, allergies, notes, birth_weight_kg, birth_length_cm, birth_head_cm
         from public.children where owner_id = $1 order by created_at, id`,
      [userId],
    ),
    query<MeasurementRow>(
      `select m.id, m.child_id, m.measured_at, m.weight_kg, m.height_cm, m.head_cm, m.note, m.source
         from public.measurements m join public.children c on c.id = m.child_id
        where c.owner_id = $1 order by m.measured_at, m.created_at`,
      [userId],
    ),
    query<{ child_id: string; vaccine_id: string; applied_at: string; lot: string; place: string }>(
      `select v.child_id, v.vaccine_id, v.applied_at, v.lot, v.place
         from public.child_vaccines v join public.children c on c.id = v.child_id where c.owner_id = $1`,
      [userId],
    ),
    query<{ child_id: string; milestone_id: string; achieved_at: string }>(
      `select m.child_id, m.milestone_id, m.achieved_at
         from public.child_milestones m join public.children c on c.id = m.child_id where c.owner_id = $1`,
      [userId],
    ),
    query<JournalRow>(
      `select j.id, j.child_id, j.kind, j.title, j.occurred_at, j.note,
              exists (select 1 from public.journal_photos p where p.entry_id = j.id) as has_photo
         from public.journal_entries j join public.children c on c.id = j.child_id
        where c.owner_id = $1 order by j.occurred_at, j.created_at`,
      [userId],
    ),
  ]);

  return {
    version: 1,
    demo: false,
    activeChildId: children.rows[0]?.id ?? null,
    children: children.rows.map<Child>((r) => ({
      id: r.id,
      name: r.name,
      birthDate: r.birth_date,
      sex: r.sex,
      tone: r.tone,
      bloodType: r.blood_type,
      allergies: r.allergies,
      notes: r.notes,
      birthWeightKg: r.birth_weight_kg,
      birthLengthCm: r.birth_length_cm,
      birthHeadCm: r.birth_head_cm,
    })),
    measurements: measurements.rows.map<Measurement>((r) => ({
      id: r.id,
      childId: r.child_id,
      measuredAt: r.measured_at,
      weightKg: r.weight_kg,
      heightCm: r.height_cm,
      headCm: r.head_cm,
      note: r.note,
      source: r.source,
    })),
    vaccineRecords: vaccines.rows.map((r) => ({ childId: r.child_id, vaccineId: r.vaccine_id, appliedAt: r.applied_at, lot: r.lot, place: r.place })),
    milestoneRecords: milestones.rows.map((r) => ({ childId: r.child_id, milestoneId: r.milestone_id, achievedAt: r.achieved_at })),
    journal: journal.rows.map<JournalEntry>((r) => ({
      id: r.id,
      childId: r.child_id,
      kind: r.kind,
      title: r.title,
      occurredAt: r.occurred_at,
      note: r.note,
      hasPhoto: r.has_photo,
    })),
  };
}
