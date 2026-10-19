// Parte pura de las cuentas (sin base de datos ni Next): validación y contraseñas.
import { randomBytes, createHash, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** Rutas y nombres que no pueden ser un usuario porque ya significan otra cosa en la app o en el sitio. */
export const RESERVED_USERNAMES = new Set([
  "api", "demo", "login", "logout", "registro", "signup", "signin", "admin", "root", "soporte", "ayuda", "app",
  "crecer", "crecimiento", "vacunas", "hitos", "diario", "perfil", "nuevo", "static", "public", "assets",
  "favicon", "robots", "sitemap", "manifest", "privacidad", "terminos", "www", "null", "undefined", "me", "yo",
]);

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** Normaliza a minúsculas y valida: 3–30 caracteres, letras, números, «_» y «-». */
export function validateUsername(raw: unknown): Checked<string> {
  if (typeof raw !== "string") return { ok: false, error: "Escribe un nombre de usuario." };
  const username = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: "El usuario debe tener de 3 a 30 caracteres: letras, números, «_» o «-», sin espacios ni tildes." };
  }
  if (RESERVED_USERNAMES.has(username)) return { ok: false, error: "Ese nombre de usuario no está disponible." };
  return { ok: true, value: username };
}

const COMMON_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "password", "password1", "contrasena", "contraseña", "qwertyui", "qwerty123",
  "iloveyou", "11111111", "00000000", "abcd1234", "12341234", "crecer123", "crecer1234",
]);

export function validatePassword(raw: unknown, username?: string): Checked<string> {
  if (typeof raw !== "string") return { ok: false, error: "Escribe una contraseña." };
  if (raw.length < 8) return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  if (raw.length > 200) return { ok: false, error: "La contraseña es demasiado larga (máximo 200 caracteres)." };
  if (COMMON_PASSWORDS.has(raw.toLowerCase()) || (username && raw.toLowerCase() === username)) {
    return { ok: false, error: "Esa contraseña es demasiado fácil de adivinar. Elige otra." };
  }
  return { ok: true, value: raw };
}

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

function scryptAsync(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Formato guardado: `scrypt$N$r$p$salt$hash` (base64). Incluye los parámetros para poder subirlos en el futuro. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const key = await scryptAsync(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

let dummy: Promise<string> | null = null;
/** Hash de relleno: se verifica contra él cuando el usuario no existe, para que la respuesta tarde lo mismo. */
export function dummyHash(): Promise<string> {
  return (dummy ??= hashPassword("relleno-para-igualar-tiempos"));
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function newSessionToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export const SESSION_DAYS = 30;
