import { fail, handleError, json } from "@/server/http";
import { getSessionUser } from "@/server/session";
import { loadState } from "@/server/state";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return fail(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
    return json(await loadState(user.id));
  } catch (e) {
    return handleError(e);
  }
}
