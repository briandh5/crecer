import { z } from "zod";
import { familyInfo, unlinkFamily } from "@/server/family";
import { fail, handleError, json, sameOrigin } from "@/server/http";
import { getSessionUser } from "@/server/session";

/** Quita a una persona de la familia (deja de ver los perfiles de esta cuenta, y esta cuenta los suyos). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    const user = await getSessionUser();
    if (!user) return fail(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
    const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
    const id = z.string().uuid().safeParse(body?.id);
    if (!id.success) return fail(400, "Datos inválidos.");
    await unlinkFamily(user.id, id.data);
    return json(await familyInfo(user.id));
  } catch (err) {
    return handleError(err);
  }
}
