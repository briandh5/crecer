import { dummyHash, hashPassword, validatePassword, validateUsername } from "@/server/auth-core";
import { query } from "@/server/db";
import { clientIp, fail, handleError, json, sameOrigin } from "@/server/http";
import { isLimited, record } from "@/server/rate-limit";
import { startSession } from "@/server/session";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    const body = (await req.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
    const u = validateUsername(body?.username);
    if (!u.ok) return fail(400, u.error);
    const p = validatePassword(body?.password, u.value);
    if (!p.ok) return fail(400, p.error);

    const bucket = `register:ip:${clientIp(req)}`;
    if (await isLimited(bucket, 10, 3600)) return fail(429, "Demasiados registros desde este lugar. Inténtalo más tarde.");
    await record(bucket);

    // Igualamos el tiempo de respuesta con y sin usuario repetido.
    await dummyHash();
    const hash = await hashPassword(p.value);
    const { rows } = await query<{ id: string }>(
      `insert into public.users (username, password_hash) values ($1, $2) on conflict (username) do nothing returning id`,
      [u.value, hash],
    );
    if (!rows[0]) return fail(409, "Ese nombre de usuario ya está en uso. Prueba con otro.");

    await startSession(rows[0].id);
    return json({ username: u.value }, 201);
  } catch (e) {
    return handleError(e);
  }
}
