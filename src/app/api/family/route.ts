import { familyInfo } from "@/server/family";
import { fail, handleError, json } from "@/server/http";
import { getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

/** Cuentas enlazadas e invitaciones pendientes de la cuenta actual. */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return fail(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
    return json(await familyInfo(user.id));
  } catch (e) {
    return handleError(e);
  }
}
