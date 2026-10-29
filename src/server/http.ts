import { NextResponse } from "next/server";
import { DbNotConfiguredError } from "./db";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const fail = (status: number, error: string) => json({ error }, status);

/** Defensa CSRF: toda petición que modifica datos debe venir de este mismo sitio. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

const CONNECTION_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "28P01", "28000", "3D000", "XX000", "08006", "08001", "08004"]);

/** Código técnico corto (SQLSTATE o de red) para poder reconocer el problema sin exponer detalles internos. */
export function errorCode(e: unknown): string | null {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

/**
 * Convierte errores inesperados en respuestas seguras. Los problemas de configuración (base sin actualizar o sin conexión)
 * se explican con claridad, porque quien los ve es quien despliega la app; el resto va genérico con un código.
 * El detalle completo queda solo en los registros del servidor.
 */
export function handleError(e: unknown) {
  console.error("[crecer] error no controlado:", e);
  if (e instanceof DbNotConfiguredError) {
    return fail(503, "Las cuentas todavía no están activadas en este sitio (falta configurar la base de datos).");
  }
  const code = errorCode(e);
  if (code === "42703" || code === "42P01") {
    return fail(503, "La base de datos necesita actualizarse: ejecuta en el SQL Editor de Supabase las migraciones de supabase/migrations que falten (0002_email_recovery.sql, 0003_family.sql) o supabase/setup.sql si la base es nueva. Abre /api/health para ver cuál. Código 42703/42P01.");
  }
  if (code && CONNECTION_CODES.has(code)) {
    return fail(503, `No se pudo conectar con la base de datos. Revisa la variable DATABASE_URL en Vercel: debe ser la del Transaction pooler y llevar la contraseña correcta (sin símbolos raros). Código ${code}.`);
  }
  return fail(500, `Algo salió mal en el servidor. Inténtalo de nuevo.${code ? ` (código ${code})` : ""}`);
}

/**
 * Dirección pública del sitio para armar enlaces en correos. Se prefiere APP_URL (fijada por quien despliega)
 * para que un encabezado Host falsificado no pueda apuntar el enlace a otro sitio.
 */
export function appUrl(req: Request): string {
  const fixed = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  return new URL(req.url).origin;
}
