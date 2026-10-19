import { fail, handleError, json, sameOrigin } from "@/server/http";
import { endSession } from "@/server/session";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    await endSession();
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
