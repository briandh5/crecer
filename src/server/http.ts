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

/** Convierte errores inesperados en respuestas seguras (sin filtrar detalles internos). */
export function handleError(e: unknown) {
  if (e instanceof DbNotConfiguredError) {
    return fail(503, "Las cuentas todavía no están activadas en este sitio (falta configurar la base de datos).");
  }
  console.error("[crecer] error no controlado:", e);
  return fail(500, "Algo salió mal en el servidor. Inténtalo de nuevo.");
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
