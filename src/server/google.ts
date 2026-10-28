import { createHash, randomBytes } from "node:crypto";
import { hashPassword, usernameFromEmail, validateEmail } from "./auth-core";
import { query } from "./db";

/**
 * Inicio de sesión con Google (OAuth 2.0 / OpenID Connect, flujo «authorization code» con PKCE).
 * No guarda nada de Google: la cuenta se reconoce por su correo verificado. Si no existe, se crea con un
 * usuario sacado del correo y una contraseña aleatoria (se puede poner una propia con «¿Olvidaste tu contraseña?»).
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
// Se puede cambiar solo para las pruebas de integración (un Google falso en local).
const TOKEN_URL = () => process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export const OAUTH_COOKIE = "crecer_oauth";

export const isGoogleConfigured = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const googleRedirectUri = (base: string) => `${base}/api/auth/google/callback`;

/** Dirección de Google a la que se manda a la persona, y los valores que hay que recordar en una cookie. */
export function googleAuthRequest(redirectUri: string) {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), cookie: `${state}.${verifier}` };
}

export class GoogleError extends Error {}

/** Cambia el código por el id_token y devuelve el correo verificado de la cuenta de Google. */
export async function googleEmail(code: string, verifier: string, redirectUri: string): Promise<string> {
  const res = await fetch(TOKEN_URL(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { id_token?: string; error?: string } | null;
  if (!res.ok || !body?.id_token) throw new GoogleError(`Google rechazó el código (${body?.error ?? res.status}).`);

  // El id_token llega directo de Google por HTTPS en esta misma petición, así que basta con leerlo y comprobar
  // a quién va dirigido (OpenID Connect Core §3.1.3.7); no hace falta verificar la firma.
  const payload = JSON.parse(Buffer.from(body.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
    iss?: string; aud?: string; exp?: number; email?: string; email_verified?: boolean | string;
  };
  if (!ISSUERS.has(payload.iss ?? "") || payload.aud !== process.env.GOOGLE_CLIENT_ID || !payload.exp || payload.exp * 1000 < Date.now()) {
    throw new GoogleError("La respuesta de Google no es válida.");
  }
  const email = validateEmail(payload.email);
  if (!email.ok || (payload.email_verified !== true && payload.email_verified !== "true")) {
    throw new GoogleError("Tu cuenta de Google no tiene un correo verificado.");
  }
  return email.value;
}

/** La cuenta con ese correo, o una nueva si no existe (null si se superó el límite de registros). */
export async function findOrCreateGoogleUser(
  email: string,
  /** Se consulta solo si hay que crear la cuenta (mismo límite que el registro normal). */
  tooManySignups: () => Promise<boolean>,
): Promise<{ id: string; username: string; created: boolean } | null> {
  const found = await query<{ id: string; username: string }>(`select id, username from public.users where email = $1`, [email]);
  if (found.rows[0]) return { ...found.rows[0], created: false };
  if (await tooManySignups()) return null;

  const hash = await hashPassword(randomBytes(32).toString("base64url"));
  const base = usernameFromEmail(email);
  for (let i = 0; i < 6; i++) {
    const username = i === 0 ? base : `${base.slice(0, 25)}${Math.floor(1000 + Math.random() * 9000)}`;
    const { rows } = await query<{ id: string }>(
      `insert into public.users (username, email, password_hash) values ($1, $2, $3) on conflict do nothing returning id`,
      [username, email, hash],
    );
    if (rows[0]) return { id: rows[0].id, username, created: true };
    // Puede que otra petición haya creado la cuenta con ese correo justo ahora.
    const again = await query<{ id: string; username: string }>(`select id, username from public.users where email = $1`, [email]);
    if (again.rows[0]) return { ...again.rows[0], created: false };
  }
  throw new GoogleError("No se pudo crear la cuenta. Inténtalo de nuevo.");
}
