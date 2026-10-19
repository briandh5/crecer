import { hashPassword, hashToken, validatePassword } from "@/server/auth-core";
import { query, tx } from "@/server/db";
import { clientIp, fail, handleError, json, sameOrigin } from "@/server/http";
import { isLimited, record } from "@/server/rate-limit";

const BAD_LINK = "El enlace no es válido o ya venció. Pide uno nuevo.";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    const body = (await req.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
    const token = typeof body?.token === "string" ? body.token : "";
    if (!token || token.length > 100) return fail(400, BAD_LINK);

    const bucket = `reset:ip:${clientIp(req)}`;
    if (await isLimited(bucket, 20, 3600)) return fail(429, "Demasiados intentos. Inténtalo más tarde.");
    await record(bucket);

    const tokenHash = hashToken(token);
    const { rows } = await query<{ user_id: string; username: string }>(
      `select r.user_id, u.username
         from public.password_resets r join public.users u on u.id = r.user_id
        where r.token_hash = $1 and r.expires_at > now()`,
      [tokenHash],
    );
    if (!rows[0]) return fail(400, BAD_LINK);

    // Se valida antes de gastar el enlace, para que una contraseña débil no obligue a pedir otro.
    const p = validatePassword(body?.password, rows[0].username);
    if (!p.ok) return fail(400, p.error);
    const hash = await hashPassword(p.value);

    const done = await tx(async (c) => {
      // Consumir el token y cambiar la contraseña van juntos; si dos peticiones compiten, solo una gana.
      const used = await c.query(`delete from public.password_resets where token_hash = $1 and expires_at > now() returning user_id`, [tokenHash]);
      if (!used.rowCount) return false;
      await c.query(`update public.users set password_hash = $2 where id = $1`, [rows[0].user_id, hash]);
      await c.query(`delete from public.password_resets where user_id = $1`, [rows[0].user_id]);
      // Si alguien más tenía la sesión abierta, deja de tenerla.
      await c.query(`delete from public.sessions where user_id = $1`, [rows[0].user_id]);
      await c.query(`delete from public.rate_events where bucket = $1`, [`login:user:${rows[0].username}`]);
      return true;
    });
    if (!done) return fail(400, BAD_LINK);
    return json({ username: rows[0].username });
  } catch (e) {
    return handleError(e);
  }
}
