import { addDays, addMonths } from "./date";
import { MILESTONES, VACCINES } from "./catalog";
import type { Child, JournalEntry, Measurement, MilestoneRecord, VaccineRecord } from "./types";

export interface DataState {
  version: 1;
  children: Child[];
  measurements: Measurement[];
  vaccineRecords: VaccineRecord[];
  milestoneRecords: MilestoneRecord[];
  journal: JournalEntry[];
  activeChildId: string | null;
  /** true mientras los datos sean los de ejemplo. */
  demo: boolean;
}

export const EMPTY_STATE: DataState = {
  version: 1,
  children: [],
  measurements: [],
  vaccineRecords: [],
  milestoneRecords: [],
  journal: [],
  activeChildId: null,
  demo: false,
};

const min = (a: string, b: string) => (a < b ? a : b);

function measurements(childId: string, birth: string, today: string, rows: [month: number, kg: number, cm: number, head?: number][]): Measurement[] {
  return rows.map(([month, kg, cm, head], i) => ({
    id: `${childId}-m${i}`,
    childId,
    measuredAt: min(addMonths(birth, month), today),
    weightKg: kg,
    heightCm: cm,
    headCm: head ?? null,
    note: i === 0 ? "" : month % 12 === 0 ? "Control de cumpleaños" : "",
    source: i === 0 ? "birth" : "manual",
  }));
}

function vaccinesUpTo(childId: string, birth: string, today: string, maxMonth: number, skip: string[] = []): VaccineRecord[] {
  return VACCINES.filter((v) => !v.optional && v.dueMonth <= maxMonth && !skip.includes(v.id)).map((v, i) => ({
    childId,
    vaccineId: v.id,
    appliedAt: min(addDays(addMonths(birth, v.dueMonth), (i % 4) + 1), today),
    lot: `${"ABCDEFGH"[i % 8]}${3100 + i * 17}`,
    place: "Centro de salud",
  }));
}

function milestonesUpTo(childId: string, birth: string, today: string, maxMonth: number, skip: string[] = []): MilestoneRecord[] {
  return MILESTONES.filter((m) => m.month <= maxMonth && !skip.includes(m.id)).map((m, i) => ({
    childId,
    milestoneId: m.id,
    achievedAt: min(addDays(addMonths(birth, m.month), (i % 9) - 2), today),
  }));
}

/** Dos hijos de ejemplo con edades relativas a hoy, para que la app se vea viva la primera vez. */
export function createDemoState(today: string): DataState {
  const vId = "demo-valentina";
  const vBirth = addMonths(today, -28);
  const mId = "demo-mateo";
  const mBirth = addMonths(today, -85);

  const valentina: Child = {
    id: vId,
    name: "Valentina",
    birthDate: vBirth,
    sex: "female",
    tone: "terracotta",
    bloodType: "O+",
    allergies: ["Polen"],
    notes: "Nació a término. Duerme mejor con luz tenue.",
    birthWeightKg: 3.2,
    birthLengthCm: 49.5,
    birthHeadCm: 34.2,
  };
  const mateo: Child = {
    id: mId,
    name: "Mateo",
    birthDate: mBirth,
    sex: "male",
    tone: "sage",
    bloodType: "A+",
    allergies: ["Penicilina", "Cacahuate"],
    notes: "Usa lentes para leer de cerca desde los 6 años.",
    birthWeightKg: 3.6,
    birthLengthCm: 51,
    birthHeadCm: 35,
  };

  return {
    version: 1,
    demo: true,
    activeChildId: vId,
    children: [valentina, mateo],
    measurements: [
      ...measurements(vId, vBirth, today, [[0, 3.2, 49.5, 34.2], [1, 4.3, 54, 37], [2, 5.2, 57.6, 38.9], [4, 6.6, 62.5, 41.2], [6, 7.6, 66, 42.8], [9, 8.5, 70.8, 44.5], [12, 9.3, 75, 45.6], [15, 10, 78.5], [18, 10.5, 81.5, 47.4], [24, 11.9, 87, 48.3], [28, 12.8, 90]]),
      ...measurements(mId, mBirth, today, [[0, 3.6, 51, 35], [6, 8.1, 68], [12, 10.2, 76], [24, 12.9, 88], [36, 15.3, 97], [48, 17.6, 105], [60, 20.4, 112.5], [72, 23.2, 119.3], [84, 24.8, 123.5]]),
    ],
    vaccineRecords: [
      ...vaccinesUpTo(vId, vBirth, today, 18),
      // Mateo: tiene todo menos la 2.ª dosis de SRP de los 6 años → se ve el estado "Pendiente".
      ...vaccinesUpTo(mId, mBirth, today, 72, ["srp-2"]),
    ],
    milestoneRecords: [
      ...milestonesUpTo(vId, vBirth, today, 24, ["co-24-3"]),
      ...milestonesUpTo(mId, mBirth, today, 84),
    ],
    journal: [
      { id: "demo-j1", childId: vId, kind: "sonrisa", title: "Primera sonrisa", occurredAt: addDays(addMonths(vBirth, 2), -6), note: "Sonrió de verdad mientras le cantábamos. ¡Nos derretimos!" },
      { id: "demo-j2", childId: vId, kind: "volteo", title: "Se dio la vuelta solita", occurredAt: addMonths(vBirth, 5), note: "Boca abajo a boca arriba, sobre la manta del parque." },
      { id: "demo-j3", childId: vId, kind: "palabra", title: "Primera palabra: «agua»", occurredAt: addMonths(vBirth, 11), note: "La dijo señalando el vaso, clarita." },
      { id: "demo-j4", childId: vId, kind: "pasos", title: "Primeros pasos", occurredAt: addDays(addMonths(vBirth, 13), 9), note: "Cuatro pasos hasta el sillón y una carcajada al final." },
      { id: "demo-j5", childId: mId, kind: "escuela", title: "Primer día de primaria", occurredAt: addMonths(mBirth, 72), note: "Mochila nueva y cero lágrimas (las lágrimas fueron nuestras)." },
    ],
  };
}
