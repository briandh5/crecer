import { addDays, addMonths, daysBetween } from "./date.ts";
import type { VaccineDef, VaccineGroupId, VaccineRecord } from "./types.ts";

export const VACCINE_GROUPS: { id: VaccineGroupId; label: string; hint: string }[] = [
  { id: "0-2m", label: "0 – 2 meses", hint: "Recién nacido y primera visita de control" },
  { id: "4m", label: "4 meses", hint: "Segunda ronda de dosis" },
  { id: "6m", label: "6 meses", hint: "Tercera dosis y primera temporada de influenza" },
  { id: "12-18m", label: "12 – 18 meses", hint: "Refuerzos del primer año" },
  { id: "escolar", label: "Escolar", hint: "4 a 9 años" },
  { id: "adolescencia", label: "Adolescencia", hint: "10 a 18 años" },
];

/** Días antes de la fecha recomendada en que una dosis ya se considera "toca ahora". */
export const DUE_WINDOW_DAYS = 30;

export type VaccineStatus = "applied" | "overdue" | "due" | "upcoming" | "optional";

export function dueDate(birthDate: string, v: Pick<VaccineDef, "dueMonth">): string {
  return addMonths(birthDate, v.dueMonth);
}

export function vaccineStatus(
  v: VaccineDef,
  record: VaccineRecord | undefined,
  birthDate: string,
  today: string,
): VaccineStatus {
  if (record) return "applied";
  if (v.optional) return "optional";
  const due = dueDate(birthDate, v);
  const untilDue = daysBetween(today, due);
  if (untilDue < -DUE_WINDOW_DAYS) return "overdue";
  if (untilDue <= DUE_WINDOW_DAYS) return "due";
  return "upcoming";
}

export const STATUS_LABEL: Record<VaccineStatus, string> = {
  applied: "Aplicada",
  overdue: "Pendiente",
  due: "Toca ahora",
  upcoming: "Próxima",
  optional: "Según esquema local",
};

/** Siguiente vacuna del esquema que todavía no se aplicó (ignora las opcionales). */
export function nextVaccine(defs: VaccineDef[], records: VaccineRecord[]): VaccineDef | null {
  const applied = new Set(records.map((r) => r.vaccineId));
  const pending = defs
    .filter((v) => !v.optional && !applied.has(v.id))
    .sort((a, b) => a.dueMonth - b.dueMonth);
  return pending[0] ?? null;
}

/** Siguiente dosis de la misma serie (p. ej. tras Hexavalente 1.ª → 2.ª). */
export function nextDoseInSeries(defs: VaccineDef[], v: VaccineDef): VaccineDef | null {
  return (
    defs
      .filter((o) => o.series === v.series && o.dueMonth > v.dueMonth)
      .sort((a, b) => a.dueMonth - b.dueMonth)[0] ?? null
  );
}

/**
 * Avance de la cartilla (0–1): dosis no opcionales ya aplicadas entre las que
 * ya corresponden a la edad actual (incluye las que tocan en los próximos 30 días).
 */
export function cardProgress(
  defs: VaccineDef[],
  records: VaccineRecord[],
  birthDate: string,
  today: string,
): { applied: number; expected: number; ratio: number } {
  const applied = new Set(records.map((r) => r.vaccineId));
  const horizon = addDays(today, DUE_WINDOW_DAYS);
  const expectedDefs = defs.filter((v) => !v.optional && dueDate(birthDate, v) <= horizon);
  const done = expectedDefs.filter((v) => applied.has(v.id)).length;
  return {
    applied: done,
    expected: expectedDefs.length,
    ratio: expectedDefs.length === 0 ? 1 : done / expectedDefs.length,
  };
}
