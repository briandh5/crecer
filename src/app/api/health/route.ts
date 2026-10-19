import { isDbConfigured, query } from "@/server/db";
import { errorCode, json } from "@/server/http";
import { isMailConfigured } from "@/server/mail";

export const dynamic = "force-dynamic";

const TABLES = ["users", "sessions", "rate_events", "children", "measurements", "vaccines", "child_vaccines", "milestones", "child_milestones", "journal_entries", "journal_photos", "password_resets"];

/**
 * Diagnóstico de puesta en marcha: dice qué falta sin revelar secretos (solo sí/no y códigos técnicos).
 * Abre https://tu-sitio/api/health
 */
export async function GET() {
  const out: Record<string, unknown> = {
    databaseUrlSet: isDbConfigured(),
    appUrlSet: !!process.env.APP_URL,
    smtpHostSet: isMailConfigured(),
    smtpUserSet: !!process.env.SMTP_USER,
    smtpPassSet: !!process.env.SMTP_PASS,
  };
  if (!isDbConfigured()) return json({ ok: false, ...out, hint: "Falta DATABASE_URL en Vercel (y un Redeploy)." });

  try {
    await query("select 1");
    out.dbConnection = "ok";
    const t = await query<{ table_name: string }>(`select table_name from information_schema.tables where table_schema = 'public'`);
    const have = new Set(t.rows.map((r) => r.table_name));
    const missingTables = TABLES.filter((x) => !have.has(x));
    const col = await query<{ n: string }>(`select count(*)::text as n from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'email'`);
    out.missingTables = missingTables;
    out.usersHasEmailColumn = Number(col.rows[0].n) > 0;
    const hint: string[] = [];
    if (missingTables.includes("users")) hint.push("Faltan las tablas: ejecuta supabase/setup.sql en el SQL Editor de Supabase.");
    else if (!out.usersHasEmailColumn || missingTables.includes("password_resets")) hint.push("Ejecuta supabase/migrations/0002_email_recovery.sql en el SQL Editor de Supabase.");
    if (!have.has("vaccines")) hint.push("Faltan los catálogos de vacunas e hitos (supabase/setup.sql los incluye).");
    if (!out.smtpHostSet) hint.push("Sin SMTP_HOST: «Olvidaste tu contraseña» no enviará correos.");
    if (!out.appUrlSet) hint.push("Sin APP_URL: los enlaces de los correos usarán la dirección con la que se pidió el enlace.");
    return json({ ok: hint.length === 0, ...out, hint });
  } catch (e) {
    out.dbConnection = "error";
    out.errorCode = errorCode(e);
    return json({
      ok: false,
      ...out,
      hint: "No se pudo conectar con la base de datos: revisa DATABASE_URL (Transaction pooler, contraseña correcta, sin símbolos raros) y haz Redeploy.",
    });
  }
}
