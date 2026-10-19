import { dummyHash, validateUsername, verifyPassword } from "@/server/auth-core";
import { query } from "@/server/db";
import { clientIp, fail, handleError, json, sameOrigin } from "@/server/http";
import { clear, isLimited, record } from "@/server/rate-limit";
import { startSession } from "@/server/session";

const BAD = "Usuario o contraseña incorrectos.";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    const body = (await req.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
    const u = validateUsername(body?.username);
    const password = typeof body?.password === "string" ? body.password : "";
    if (!u.ok || !password || password.length > 200) return fail(401, BAD);

    // Máximo 10 fallos cada 15 minutos por usuario y 30 por IP.
    const userBucket = `login:user:${u.value}`;
    const ipBucket = `login:ip:${clientIp(req)}`;
    if ((await isLimited(userBucket, 10, 900)) || (await isLimited(ipBucket, 30, 900))) {
      return fail(429, "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
    }

    const { rows } = await query<{ id: string; password_hash: string }>(
      `select id, password_hash from public.users where username = $1`,
      [u.value],
    );
    const user = rows[0];
    const ok = await verifyPassword(password, user?.password_hash ?? (await dummyHash()));
    if (!user || !ok) {
      await record(userBucket);
      await record(ipBucket);
      return fail(401, BAD);
    }

    await clear(userBucket);
    await startSession(user.id);
    return json({ username: u.value });
  } catch (e) {
    return handleError(e);
  }
}
