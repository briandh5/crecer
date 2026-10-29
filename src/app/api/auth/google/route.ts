import { NextResponse } from "next/server";
import { googleAuthRequest, googleRedirectUri, isGoogleConfigured, OAUTH_COOKIE, safeNext } from "@/server/google";
import { appUrl } from "@/server/http";

export const dynamic = "force-dynamic";

/** Manda a la persona a elegir su cuenta de Google. */
export async function GET(req: Request) {
  const base = appUrl(req);
  if (!isGoogleConfigured()) return NextResponse.redirect(`${base}/?google=off`);
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const { url, cookie } = googleAuthRequest(googleRedirectUri(base), next);
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
