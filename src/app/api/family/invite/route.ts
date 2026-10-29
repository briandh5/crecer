import { newResetToken, validateEmail } from "@/server/auth-core";
import { query } from "@/server/db";
import { familyInfo, INVITE_DAYS } from "@/server/family";
import { appUrl, fail, handleError, json, sameOrigin } from "@/server/http";
import { inviteEmail, isMailConfigured, sendMail } from "@/server/mail";
import { isLimited, record } from "@/server/rate-limit";
import { getSessionUser } from "@/server/session";

/** Invita por correo a otra persona a la familia de esta cuenta. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    const user = await getSessionUser();
    if (!user) return fail(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
    if (!isMailConfigured()) return fail(503, "El envío de correos todavía no está activado en este sitio.");

    const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
    const e = validateEmail(body?.email);
    if (!e.ok) return fail(400, e.error);
    if (e.value === user.email) return fail(400, "Ese es tu propio correo. Escribe el de la persona que quieres invitar.");

    const info = await familyInfo(user.id);
    if (info.members.some((m) => m.email === e.value)) return fail(409, "Esa persona ya está en tu familia.");

    const bucket = `invite:user:${user.id}`;
    if (await isLimited(bucket, 10, 3600)) return fail(429, "Enviaste muchas invitaciones. Inténtalo más tarde.");
    await record(bucket);

    // Una sola invitación vigente por correo: la nueva anula la anterior.
    const { token, hash } = newResetToken();
    await query(`delete from public.family_invites where (inviter_id = $1 and email = $2) or expires_at < now()`, [user.id, e.value]);
    await query(
      `insert into public.family_invites (token_hash, inviter_id, email, expires_at) values ($1, $2, $3, now() + make_interval(days => $4))`,
      [hash, user.id, e.value, INVITE_DAYS],
    );

    const link = `${appUrl(req)}/invitacion?token=${token}`;
    try {
      await sendMail(inviteEmail({ to: e.value, inviter: user.username, link, days: INVITE_DAYS }));
    } catch (err) {
      console.error("[crecer] no se pudo enviar la invitación:", err);
      await query(`delete from public.family_invites where token_hash = $1`, [hash]);
      return fail(502, "No se pudo enviar el correo. Revisa la dirección e inténtalo de nuevo.");
    }
    return json(await familyInfo(user.id));
  } catch (err) {
    return handleError(err);
  }
}
