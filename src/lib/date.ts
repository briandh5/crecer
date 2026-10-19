// Utilidades de fecha sin zona horaria: todo se maneja como "YYYY-MM-DD".
// Los cálculos usan UTC para que el resultado no cambie según el huso del dispositivo.

const DAY_MS = 86_400_000;
export const DAYS_PER_MONTH = 30.4375;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function toUTC(iso: string): number {
  const { y, m, d } = parseISO(iso);
  return Date.UTC(y, m - 1, d);
}

export function toISO(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Fecha de hoy en la zona horaria del dispositivo. */
export function todayISO(now: Date = new Date()): string {
  return toISO(now);
}

export function daysBetween(fromISO: string, toISOStr: string): number {
  return Math.round((toUTC(toISOStr) - toUTC(fromISO)) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  const t = new Date(toUTC(iso) + days * DAY_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** Suma meses calendario; si el día no existe en el mes destino, usa el último día (31 ene + 1 mes = 28/29 feb). */
export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parseISO(iso);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${ny}-${p(nm + 1)}-${p(Math.min(d, last))}`;
}

/** Edad desglosada entre dos fechas. */
export function ageParts(birthISO: string, refISO: string): { years: number; months: number; days: number } {
  const b = parseISO(birthISO);
  const r = parseISO(refISO);
  let months = (r.y - b.y) * 12 + (r.m - b.m);
  if (r.d < b.d) months -= 1;
  if (months < 0) return { years: 0, months: 0, days: 0 };
  const anchor = addMonths(birthISO, months);
  return { years: Math.floor(months / 12), months: months % 12, days: daysBetween(anchor, refISO) };
}

/** Meses completos cumplidos. */
export function ageInMonths(birthISO: string, refISO: string): number {
  const { years, months } = ageParts(birthISO, refISO);
  return years * 12 + months;
}

/** Edad fraccionaria en meses (para el eje X de las gráficas). */
export function ageInMonthsExact(birthISO: string, refISO: string): number {
  return Math.max(0, daysBetween(birthISO, refISO) / DAYS_PER_MONTH);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 años 3 meses", "8 meses", "12 días". */
export function formatAge(birthISO: string, refISO: string): string {
  const { years, months, days } = ageParts(birthISO, refISO);
  if (years === 0 && months === 0) return days === 0 ? "Recién nacido/a" : plural(days, "día", "días");
  if (years === 0) return plural(months, "mes", "meses");
  if (months === 0) return plural(years, "año", "años");
  return `${plural(years, "año", "años")} ${plural(months, "mes", "meses")}`;
}

/** Edad a partir de un número de meses: 30 → "2 años y medio"; 9 → "9 meses". */
export function formatMonths(totalMonths: number): string {
  if (totalMonths < 24) return totalMonths === 1 ? "1 mes" : `${totalMonths} meses`;
  const years = Math.floor(totalMonths / 12);
  const rest = totalMonths % 12;
  if (rest === 0) return `${years} años`;
  if (rest === 6) return `${years} años y medio`;
  return `${years} años ${rest} meses`;
}

export function formatDate(iso: string, withYear = true): string {
  const { y, m, d } = parseISO(iso);
  return withYear ? `${d} ${MESES[m - 1]} ${y}` : `${d} ${MESES[m - 1]}`;
}

/** "en 12 días", "hace 3 días", "hoy". */
export function relativeDays(targetISO: string, refISO: string): string {
  const n = daysBetween(refISO, targetISO);
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  if (n === -1) return "ayer";
  const abs = Math.abs(n);
  const label = abs >= 60 ? `${Math.round(abs / DAYS_PER_MONTH)} meses` : `${abs} días`;
  return n > 0 ? `en ${label}` : `hace ${label}`;
}
