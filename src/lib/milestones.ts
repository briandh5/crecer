import { formatMonths } from "./date.ts";
import type { MilestoneDef, MilestoneDomain, MilestoneRecord } from "./types.ts";

export const DOMAINS: { id: MilestoneDomain; label: string; short: string }[] = [
  { id: "mg", label: "Motricidad gruesa", short: "Mov. grueso" },
  { id: "mf", label: "Motricidad fina", short: "Mov. fino" },
  { id: "le", label: "Lenguaje", short: "Lenguaje" },
  { id: "se", label: "Socioemocional", short: "Socioemoc." },
  { id: "co", label: "Cognitivo", short: "Cognitivo" },
];

/** Meses de margen: un hito se evalúa cuando ya pasaron al menos 2 meses desde la edad en que se espera. */
export const GRACE_MONTHS = 2;

export type DevState = "pending-data" | "expected" | "watch" | "consult";

export interface DomainSummary {
  domain: MilestoneDomain;
  /** Hitos que ya deberían estar logrados (edad esperada + margen ≤ edad actual). */
  evaluable: number;
  /** De esos, cuántos están marcados. */
  achieved: number;
  /** Total marcados en el dominio (incluye los de etapas futuras). */
  achievedTotal: number;
  state: DevState;
}

export const STATE_LABEL: Record<DevState, string> = {
  "pending-data": "Aún es pronto",
  expected: "Dentro de lo esperado",
  watch: "Vale la pena observar",
  consult: "Conversa con tu pediatra",
};

export function domainState(evaluable: number, achieved: number): DevState {
  if (evaluable === 0) return "pending-data";
  const ratio = achieved / evaluable;
  if (ratio >= 0.8) return "expected";
  if (ratio >= 0.5) return "watch";
  return "consult";
}

export function summarize(
  defs: MilestoneDef[],
  records: MilestoneRecord[],
  ageMonths: number,
): DomainSummary[] {
  const done = new Set(records.map((r) => r.milestoneId));
  return DOMAINS.map(({ id }) => {
    const mine = defs.filter((d) => d.domain === id);
    const evaluable = mine.filter((d) => d.month + GRACE_MONTHS <= ageMonths);
    const achieved = evaluable.filter((d) => done.has(d.id)).length;
    return {
      domain: id,
      evaluable: evaluable.length,
      achieved,
      achievedTotal: mine.filter((d) => done.has(d.id)).length,
      state: domainState(evaluable.length, achieved),
    };
  });
}

const SEVERITY: Record<DevState, number> = { "pending-data": 0, expected: 1, watch: 2, consult: 3 };

/** Estado global = el más atento entre los dominios con datos. */
export function overallState(summaries: DomainSummary[]): DevState {
  return summaries.reduce<DevState>(
    (worst, s) => (SEVERITY[s.state] > SEVERITY[worst] ? s.state : worst),
    "pending-data",
  );
}

/** Avance global (0–1) entre los hitos evaluables. Sin hitos evaluables → 1. */
export function overallRatio(summaries: DomainSummary[]): number {
  const evaluable = summaries.reduce((n, s) => n + s.evaluable, 0);
  const achieved = summaries.reduce((n, s) => n + s.achieved, 0);
  return evaluable === 0 ? 1 : achieved / evaluable;
}

/** Edades de control (en meses) presentes en el catálogo, ordenadas. */
export function checkpoints(defs: MilestoneDef[]): number[] {
  return [...new Set(defs.map((d) => d.month))].sort((a, b) => a - b);
}

/** Control "actual": el más reciente cuya edad esperada ya llegó (o el primero si aún no llega ninguno). */
export function currentCheckpoint(points: number[], ageMonths: number): number {
  const reached = points.filter((p) => p <= ageMonths);
  return reached.length ? reached[reached.length - 1] : points[0];
}

export function checkpointLabel(month: number): string {
  return `${formatMonths(month)}`;
}

/** Último hito marcado (por fecha de logro; desempata por edad esperada). */
export function lastAchieved(
  defs: MilestoneDef[],
  records: MilestoneRecord[],
): { def: MilestoneDef; achievedAt: string } | null {
  const byId = new Map(defs.map((d) => [d.id, d]));
  let best: { def: MilestoneDef; achievedAt: string } | null = null;
  for (const r of records) {
    const def = byId.get(r.milestoneId);
    if (!def) continue;
    if (
      !best ||
      r.achievedAt > best.achievedAt ||
      (r.achievedAt === best.achievedAt && def.month > best.def.month)
    ) {
      best = { def, achievedAt: r.achievedAt };
    }
  }
  return best;
}
