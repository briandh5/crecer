// Tipos de la app. Reflejan las tablas de supabase/migrations/0001_schema.sql
// (con camelCase en lugar de snake_case).

export type Sex = "female" | "male" | "unspecified";

export type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown";

export type Tone = "moss" | "sage" | "terracotta" | "sand";

export interface Child {
  id: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  sex: Sex;
  tone: Tone;
  bloodType: BloodType;
  allergies: string[];
  notes: string;
  birthWeightKg: number | null;
  birthLengthCm: number | null;
  birthHeadCm: number | null;
}

export interface Measurement {
  id: string;
  childId: string;
  measuredAt: string;
  weightKg: number | null;
  heightCm: number | null;
  headCm: number | null;
  note: string;
  /** "birth" la crea la ficha inicial y se mantiene sincronizada con ella. */
  source: "birth" | "manual";
}

export interface VaccineDef {
  id: string;
  series: string;
  name: string;
  dose: string;
  protectsAgainst: string;
  dueMonth: number;
  group: VaccineGroupId;
  optional?: boolean;
}

export type VaccineGroupId = "0-2m" | "4m" | "6m" | "12-18m" | "escolar" | "adolescencia";

export interface VaccineRecord {
  childId: string;
  vaccineId: string;
  appliedAt: string;
  lot: string;
  place: string;
}

export type MilestoneDomain = "mg" | "mf" | "le" | "se" | "co";

export interface MilestoneDef {
  id: string;
  domain: MilestoneDomain;
  month: number;
  text: string;
}

export interface MilestoneRecord {
  childId: string;
  milestoneId: string;
  achievedAt: string;
}

export type JournalKind = "sonrisa" | "volteo" | "palabra" | "pasos" | "diente" | "escuela" | "otro";

export interface JournalEntry {
  id: string;
  childId: string;
  kind: JournalKind;
  title: string;
  occurredAt: string;
  note: string;
}
