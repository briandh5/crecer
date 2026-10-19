import { dummyHash, hashPassword, validateEmail, validatePassword, validateUsername } from "@/server/auth-core";
import { query } from "@/server/db";
import { clientIp, fail, handleError, json, sameOrigin } from "@/server/http";
import { isLimited, record } from "@/server/rate-limit";
import { startSession } from "@/server/session";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    const body = (await req.json().catch(() => null)) as { username?: unknown; email?: unknown; password?: unknown } | null;
    const u = validateUsername(body?.username);
    if (!u.ok) return fail(400, u.error);
    const e = validateEmail(body?.email);
    if (!e.ok) return fail(400, e.error);
    const p = validatePassword(body?.password, u.value);
    if (!p.ok) return fail(400, p.error);

    const bucket = `register:ip:${clientIp(req)}`;
    if (await isLimited(bucket, 10, 3600)) return fail(429, "Demasiados registros desde este lugar. Inténtalo más tarde.");
    await record(bucket);

    // Igualamos el tiempo de respuesta con y sin usuario repetido.
    await dummyHash();
    const hash = await hashPassword(p.value);
    try {
      const { rows } = await query<{ id: string }>(
        `insert into public.users (username, email, password_hash) values ($1, $2, $3) returning id`,
        [u.value, e.value, hash],
      );
      await startSession(rows[0].id);
      return json({ username: u.value }, 201);
    } catch (err) {
      const pg = err as { code?: string; constraint?: string };
      if (pg.code === "23505") {
        return pg.constraint === "users_email_key"
          ? fail(409, "Ese correo ya tiene una cuenta. Entra con ella o recupera tu contraseña.")
          : fail(409, "Ese nombre de usuario ya está en uso. Prueba con otro.");
      }
      throw err;
    }
  } catch (err) {
    return handleError(err);
  }
}
