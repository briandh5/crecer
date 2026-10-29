import { hashToken } from "@/server/auth-core";
import { query } from "@/server/db";
import { linkFamily } from "@/server/family";
import { fail, handleError, json, sameOrigin } from "@/server/http";
import { getSessionUser } from "@/server/session";

/** Acepta una invitación: enlaza la cuenta actual con la de quien invitó. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    const user = await getSessionUser();
    if (!user) return fail(401, "Entra a tu cuenta para aceptar la invitación.");
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    const token = typeof body?.token === "string" && body.token.length <= 100 ? body.token : "";
    const { rows } = await query<{ inviter_id: string; email: string }>(
      `select inviter_id, email from public.family_invites where token_hash = $1 and expires_at > now()`,
      [hashToken(token)],
    );
    const invite = rows[0];
    if (!invite) return fail(404, "Esta invitación ya no es válida: caducó, se anuló o ya se usó. Pide una nueva.");
    // Solo la persona invitada: si el enlace se reenvía, no sirve con otra cuenta.
    if (invite.email !== user.email) return fail(403, `Esta invitación es para ${invite.email}. Entra con la cuenta que tiene ese correo.`);
    if (invite.inviter_id !== user.id) await linkFamily(user.id, invite.inviter_id);
    await query(`delete from public.family_invites where token_hash = $1`, [hashToken(token)]);
    return json({ username: user.username });
  } catch (e) {
    return handleError(e);
  }
}
