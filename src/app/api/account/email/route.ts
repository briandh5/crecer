import { validateEmail, verifyPassword } from "@/server/auth-core";
import { query } from "@/server/db";
import { fail, handleError, json, sameOrigin } from "@/server/http";
import { isLimited, record } from "@/server/rate-limit";
import { getSessionUser } from "@/server/session";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    const user = await getSessionUser();
    if (!user) return fail(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
    const body = (await req.json().catch(() => null)) as { password?: unknown; email?: unknown } | null;
    const password = typeof body?.password === "string" ? body.password : "";

    const bucket = `account:email:${user.id}`;
    if (await isLimited(bucket, 10, 900)) return fail(429, "Demasiados intentos. Espera unos minutos.");

    const { rows } = await query<{ password_hash: string }>(`select password_hash from public.users where id = $1`, [user.id]);
    if (!password || password.length > 200 || !rows[0] || !(await verifyPassword(password, rows[0].password_hash))) {
      await record(bucket);
      return fail(403, "La contraseña no es correcta.");
    }
    const e = validateEmail(body?.email);
    if (!e.ok) return fail(400, e.error);

    try {
      await query(`update public.users set email = $2 where id = $1`, [user.id, e.value]);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") return fail(409, "Ese correo ya está en uso por otra cuenta.");
      throw err;
    }
    return json({ email: e.value });
  } catch (e) {
    return handleError(e);
  }
}
