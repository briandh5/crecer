import { ActionError, applyAction } from "@/server/actions";
import { fail, handleError, json, sameOrigin } from "@/server/http";
import { getSessionUser } from "@/server/session";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    const user = await getSessionUser();
    if (!user) return fail(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
    const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
    await applyAction(user.id, body?.action);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ActionError) return fail(e.status, e.message);
    return handleError(e);
  }
}
