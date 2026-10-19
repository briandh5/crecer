import { hashPassword, validatePassword, verifyPassword } from "@/server/auth-core";
import { query } from "@/server/db";
import { fail, handleError, json, sameOrigin } from "@/server/http";
import { isLimited, record } from "@/server/rate-limit";
import { endOtherSessions, getSessionUser } from "@/server/session";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    const user = await getSessionUser();
    if (!user) return fail(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
    const body = (await req.json().catch(() => null)) as { current?: unknown; next?: unknown } | null;
    const current = typeof body?.current === "string" ? body.current : "";

    const bucket = `account:pw:${user.id}`;
    if (await isLimited(bucket, 10, 900)) return fail(429, "Demasiados intentos. Espera unos minutos.");

    const { rows } = await query<{ password_hash: string }>(`select password_hash from public.users where id = $1`, [user.id]);
    if (!current || current.length > 200 || !rows[0] || !(await verifyPassword(current, rows[0].password_hash))) {
      await record(bucket);
      return fail(403, "La contraseña actual no es correcta.");
    }
    const p = validatePassword(body?.next, user.username);
    if (!p.ok) return fail(400, p.error);

    await query(`update public.users set password_hash = $2 where id = $1`, [user.id, await hashPassword(p.value)]);
    await endOtherSessions(user.id, user.sessionHash);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
