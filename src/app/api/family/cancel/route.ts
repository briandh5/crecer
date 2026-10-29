import { validateEmail } from "@/server/auth-core";
import { query } from "@/server/db";
import { familyInfo } from "@/server/family";
import { fail, handleError, json, sameOrigin } from "@/server/http";
import { getSessionUser } from "@/server/session";

/** Anula la invitación pendiente a un correo. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    const user = await getSessionUser();
    if (!user) return fail(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
    const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
    const e = validateEmail(body?.email);
    if (!e.ok) return fail(400, e.error);
    await query(`delete from public.family_invites where inviter_id = $1 and email = $2`, [user.id, e.value]);
    return json(await familyInfo(user.id));
  } catch (err) {
    return handleError(err);
  }
}
