import { cache } from "react";
import { cookies } from "next/headers";
import { hashToken, newSessionToken, SESSION_DAYS } from "./auth-core";
import { query } from "./db";

export const SESSION_COOKIE = "crecer_session";

export interface SessionUser {
  id: string;
  username: string;
}

/** Usuario de la sesión actual (o null). Se memoriza por petición. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const { rows } = await query<SessionUser>(
    `select u.id, u.username
       from public.sessions s join public.users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
});

export async function startSession(userId: string): Promise<void> {
  const { token, hash } = newSessionToken();
  await query(
    `insert into public.sessions (token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(days => $3))`,
    [hash, userId, SESSION_DAYS],
  );
  // Aprovecha para limpiar sesiones vencidas.
  await query(`delete from public.sessions where expires_at < now()`).catch(() => {});
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await query(`delete from public.sessions where token_hash = $1`, [hashToken(token)]).catch(() => {});
  jar.delete(SESSION_COOKIE);
}
