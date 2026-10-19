const nf = new Map<number, Intl.NumberFormat>();

/** Número con coma decimal ("12,8"). */
export function num(n: number, digits = 1): string {
  let f = nf.get(digits);
  if (!f) {
    f = new Intl.NumberFormat("es", { minimumFractionDigits: 0, maximumFractionDigits: digits });
    nf.set(digits, f);
  }
  return f.format(n);
}

export function signed(n: number, digits = 1): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${num(Math.abs(n), digits)}`;
}

/** Convierte lo que escribe una persona ("12,5" o "12.5") en número; vacío → null; inválido → NaN. */
export function parseDecimal(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN;
}
