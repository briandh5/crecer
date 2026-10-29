import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findOrCreateGoogleUser, GoogleError, googleEmail, googleRedirectUri, isGoogleConfigured, OAUTH_COOKIE } from "@/server/google";
import { appUrl, clientIp } from "@/server/http";
import { isLimited, record } from "@/server/rate-limit";
import { startSession } from "@/server/session";

export const dynamic = "force-dynamic";

/** Google vuelve aquí con un código; si todo cuadra, se abre la sesión y se va al perfil. */
export async function GET(req: Request) {
  const base = appUrl(req);
  const back = (reason: string) => NextResponse.redirect(`${base}/?google=${reason}`);
  if (!isGoogleConfigured()) return back("off");

  const params = new URL(req.url).searchParams;
  const jar = await cookies();
  const saved = jar.get(OAUTH_COOKIE)?.value ?? "";
  jar.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
  if (params.get("error")) return back("cancelado");

  // El «state» debe ser el que guardamos al salir: así nadie puede colarnos un código ajeno (CSRF).
  const [state, verifier] = saved.split(".");
  const code = params.get("code");
  if (!state || !verifier || !code || params.get("state") !== state) return back("error");

  try {
    const email = await googleEmail(code, verifier, googleRedirectUri(base));
    const bucket = `register:ip:${clientIp(req)}`;
    const user = await findOrCreateGoogleUser(email, () => isLimited(bucket, 10, 3600));
    if (!user) return back("limite");
    if (user.created) await record(bucket);
    await startSession(user.id);
    return NextResponse.redirect(`${base}/${user.username}`);
  } catch (e) {
    if (!(e instanceof GoogleError)) console.error("[crecer] error con Google:", e);
    else console.warn("[crecer] Google:", e.message);
    return back("error");
  }
}
