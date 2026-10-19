import { after } from "next/server";
import { newResetToken, RESET_MINUTES, validateEmail, validateUsername } from "@/server/auth-core";
import { query } from "@/server/db";
import { appUrl, clientIp, fail, handleError, json, sameOrigin } from "@/server/http";
import { isMailConfigured, resetEmail, sendMail } from "@/server/mail";
import { isLimited, record } from "@/server/rate-limit";

/** La respuesta es siempre la misma, exista o no la cuenta, para no revelar quién está registrado. */
const OK = { ok: true };

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    if (!isMailConfigured()) return fail(503, "La recuperación por correo todavía no está activada en este sitio.");

    const body = (await req.json().catch(() => null)) as { identifier?: unknown } | null;
    const raw = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const byEmail = raw.includes("@");
    const id = byEmail ? validateEmail(raw) : validateUsername(raw);
    if (!id.ok) return json(OK);

    const ipBucket = `forgot:ip:${clientIp(req)}`;
    if (await isLimited(ipBucket, 5, 3600)) return fail(429, "Demasiadas solicitudes. Inténtalo más tarde.");
    await record(ipBucket);

    const { rows } = await query<{ id: string; username: string; email: string | null }>(
      `select id, username, email from public.users where ${byEmail ? "email" : "username"} = $1`,
      [id.value],
    );
    const user = rows[0];
    if (!user?.email) return json(OK);

    const userBucket = `forgot:user:${user.id}`;
    if (await isLimited(userBucket, 3, 3600)) return json(OK);
    await record(userBucket);

    // Un solo enlace vigente por cuenta: el nuevo anula los anteriores.
    const { token, hash } = newResetToken();
    await query(`delete from public.password_resets where user_id = $1 or expires_at < now()`, [user.id]);
    await query(`insert into public.password_resets (token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(mins => $3))`, [
      hash,
      user.id,
      RESET_MINUTES,
    ]);

    const link = `${appUrl(req)}/restablecer?token=${token}`;
    const mail = resetEmail({ to: user.email, username: user.username, link, minutes: RESET_MINUTES });
    // Se envía después de responder: así el tiempo de respuesta no delata si la cuenta existe.
    after(async () => {
      try {
        await sendMail(mail);
      } catch (e) {
        console.error("[crecer] no se pudo enviar el correo de restablecimiento:", e);
      }
    });
    return json(OK);
  } catch (e) {
    return handleError(e);
  }
}
