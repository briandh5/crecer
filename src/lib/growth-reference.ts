// Mediana de referencia de crecimiento de la OMS (Patrones de crecimiento 2006, 0–5 años).
//
// ⚠ Valores redondeados y transcritos como orientación visual, sin percentiles ni puntuaciones z.
// Antes de usar la app como herramienta clínica, sustitúyelos por las tablas LMS oficiales de la OMS:
// https://www.who.int/tools/child-growth-standards/standards
//
// Cada fila es [mes, mediana]. Entre filas se interpola linealmente.

type Row = [month: number, median: number];

const WEIGHT_BOYS: Row[] = [[0, 3.3], [1, 4.5], [2, 5.6], [3, 6.4], [4, 7.0], [5, 7.5], [6, 7.9], [9, 8.9], [12, 9.6], [18, 10.9], [24, 12.2], [30, 13.3], [36, 14.3], [42, 15.3], [48, 16.3], [54, 17.3], [60, 18.3]];
const WEIGHT_GIRLS: Row[] = [[0, 3.2], [1, 4.2], [2, 5.1], [3, 5.8], [4, 6.4], [5, 6.9], [6, 7.3], [9, 8.2], [12, 8.9], [18, 10.2], [24, 11.5], [30, 12.7], [36, 13.9], [42, 15.0], [48, 16.1], [54, 17.2], [60, 18.2]];
const HEIGHT_BOYS: Row[] = [[0, 49.9], [1, 54.7], [2, 58.4], [3, 61.4], [4, 63.9], [5, 65.9], [6, 67.6], [9, 72.0], [12, 75.7], [18, 82.3], [24, 87.1], [30, 91.9], [36, 96.1], [42, 99.9], [48, 103.3], [54, 106.7], [60, 110.0]];
const HEIGHT_GIRLS: Row[] = [[0, 49.1], [1, 53.7], [2, 57.1], [3, 59.8], [4, 62.1], [5, 64.0], [6, 65.7], [9, 70.1], [12, 74.0], [18, 80.7], [24, 85.7], [30, 90.7], [36, 95.1], [42, 99.0], [48, 102.7], [54, 106.2], [60, 109.4]];

export const REFERENCE_MAX_MONTH = 60;

export type Metric = "weight" | "height";

function table(metric: Metric, sex: "female" | "male"): Row[] {
  if (metric === "weight") return sex === "female" ? WEIGHT_GIRLS : WEIGHT_BOYS;
  return sex === "female" ? HEIGHT_GIRLS : HEIGHT_BOYS;
}

function interpolate(rows: Row[], month: number): number {
  if (month <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) {
    const [m1, v1] = rows[i];
    if (month <= m1) {
      const [m0, v0] = rows[i - 1];
      return v0 + ((v1 - v0) * (month - m0)) / (m1 - m0);
    }
  }
  return rows[rows.length - 1][1];
}

/** Mediana para una edad en meses. Si el sexo no está especificado, promedia ambas tablas. Devuelve null pasados los 5 años. */
export function referenceMedian(metric: Metric, sex: "female" | "male" | "unspecified", month: number): number | null {
  if (month > REFERENCE_MAX_MONTH) return null;
  if (sex === "unspecified") {
    return (interpolate(table(metric, "female"), month) + interpolate(table(metric, "male"), month)) / 2;
  }
  return interpolate(table(metric, sex), month);
}

/** Puntos de la curva de referencia para dibujarla (hasta `maxMonth`, sin pasar de los 5 años). */
export function referenceSeries(metric: Metric, sex: "female" | "male" | "unspecified", maxMonth: number) {
  const end = Math.min(maxMonth, REFERENCE_MAX_MONTH);
  const points: { month: number; ref: number }[] = [];
  const step = end <= 24 ? 1 : 3;
  for (let m = 0; m < end; m += step) points.push({ month: m, ref: round1(referenceMedian(metric, sex, m)!) });
  points.push({ month: end, ref: round1(referenceMedian(metric, sex, end)!) });
  return points;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
