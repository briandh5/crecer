// Metáfora visual: la etapa de cada hijo/a es el ciclo de vida de una planta.

export type StageId = "brote" | "arbolito" | "arbol";

export interface Stage {
  id: StageId;
  label: string;
  range: string;
  /** Mes en que empieza y en que termina la etapa. */
  from: number;
  to: number;
  blurb: string;
}

export const ADULT_MONTH = 18 * 12;

export const STAGES: Stage[] = [
  { id: "brote", label: "Brote", range: "0 – 2 años", from: 0, to: 24, blurb: "Echando raíces: todo es descubrimiento." },
  { id: "arbolito", label: "Arbolito", range: "2 – 10 años", from: 24, to: 120, blurb: "Creciendo firme y explorando el mundo." },
  { id: "arbol", label: "Árbol en crecimiento", range: "10 – 18 años", from: 120, to: ADULT_MONTH, blurb: "Ganando altura, ramas e identidad." },
];

export function stageFor(ageMonths: number): Stage {
  return STAGES.find((s) => ageMonths < s.to) ?? STAGES[STAGES.length - 1];
}

export function nextStage(stage: Stage): Stage | null {
  const i = STAGES.findIndex((s) => s.id === stage.id);
  return STAGES[i + 1] ?? null;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Avance dentro de la etapa actual (0–1). */
export function stageProgress(ageMonths: number, stage: Stage = stageFor(ageMonths)): number {
  return clamp01((ageMonths - stage.from) / (stage.to - stage.from));
}

/** Avance del recorrido completo hasta los 18 años (0–1). */
export function journeyProgress(ageMonths: number): number {
  return clamp01(ageMonths / ADULT_MONTH);
}
