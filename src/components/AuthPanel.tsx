"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

interface Props {
  /** Usuario con el que se abre la pantalla (p. ej. al visitar /briandh444). */
  initialUsername?: string;
  /** Si es true, el usuario no se puede cambiar: solo se pide la contraseña. */
  lockUsername?: boolean;
  allowRegister?: boolean;
  defaultTab?: "login" | "register";
  /** Muestra «Continuar con Google» (solo si el sitio tiene configuradas las claves de Google). */
  google?: boolean;
  /** Aviso con el que se abre la pantalla (p. ej. si falló el inicio con Google). */
  initialError?: string | null;
}

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function AuthPanel({
  initialUsername = "",
  lockUsername = false,
  allowRegister = true,
  defaultTab = "login",
  google = false,
  initialError = null,
}: Props) {
  const [tab, setTab] = useState<"login" | "register">(lockUsername ? "login" : defaultTab);
  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);

  const register = tab === "register";
  const cleanUser = username.trim().toLowerCase();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // Para entrar vale el usuario o el correo; para registrarse, un usuario con el formato del enlace.
    const loginByEmail = !register && cleanUser.includes("@");
    if (loginByEmail ? !EMAIL_RE.test(cleanUser) : !USERNAME_RE.test(cleanUser)) {
      return setError(
        loginByEmail
          ? "Escribe un correo válido, por ejemplo nombre@correo.com."
          : "El usuario debe tener de 3 a 30 caracteres: letras minúsculas, números, «_» o «-», sin espacios ni tildes.",
      );
    }
    if (register) {
      if (!EMAIL_RE.test(email.trim())) return setError("Escribe un correo válido: lo usaremos para que puedas recuperar tu contraseña.");
      if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
      if (password !== confirm) return setError("Las contraseñas no coinciden.");
    } else if (!password) {
      return setError("Escribe tu contraseña.");
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${register ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(register ? { username: cleanUser, email: email.trim(), password } : { username: cleanUser, password }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; username?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? "No se pudo completar. Inténtalo de nuevo.");
        return;
      }
      // Navegación completa: así el servidor ya ve la sesión nueva y carga tus datos.
      window.location.assign(`/${body?.username ?? cleanUser}`);
    } catch {
      setError("Sin conexión. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card w-full max-w-md space-y-5">
      {!lockUsername && allowRegister && (
        <div role="tablist" aria-label="Acceso" className="grid grid-cols-2 rounded-2xl bg-linen-100 p-1">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setError(null);
              }}
              className={`min-h-[44px] rounded-xl text-sm font-bold transition ${tab === t ? "bg-white text-moss shadow-soft" : "text-ink-muted hover:text-ink"}`}
            >
              {t === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          ))}
        </div>
      )}

      {google && (
        <>
          {/* Enlace normal (no fetch): Google tiene que abrirse como página completa. */}
          <a href="/api/auth/google" className="btn-soft w-full gap-3">
            <GoogleIcon />
            Continuar con Google
          </a>
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-ink-muted" aria-hidden>
            <span className="h-px flex-1 bg-linen-200" /> o con tu usuario <span className="h-px flex-1 bg-linen-200" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="a-user" className="label">{register || lockUsername ? "Usuario" : "Usuario o correo"}</label>
          <input
            id="a-user"
            className="field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            readOnly={lockUsername}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={30}
            placeholder="briandh444"
          />
          {register && (
            <p className="mt-1.5 text-xs text-ink-muted">
              Tu perfil estará en <strong className="break-all text-ink-soft">{host || "…"}/{cleanUser || "tu-usuario"}</strong>
            </p>
          )}
        </div>
        {register && (
          <div>
            <label htmlFor="a-email" className="label">Correo electrónico</label>
            <input
              id="a-email"
              className="field"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              placeholder="nombre@correo.com"
            />
            <p className="mt-1.5 text-xs text-ink-muted">Solo lo usamos para que puedas recuperar tu contraseña.</p>
          </div>
        )}
        <div>
          <label htmlFor="a-pass" className="label">Contraseña</label>
          <div className="relative">
            <input
              id="a-pass"
              className="field pr-24"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={register ? "new-password" : "current-password"}
              maxLength={200}
              autoFocus={lockUsername}
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-bold text-moss hover:bg-moss-50" aria-pressed={show}>
              {show ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>
        {register && (
          <div>
            <label htmlFor="a-pass2" className="label">Repite la contraseña</label>
            <input id="a-pass2" className="field" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" maxLength={200} />
            <p className="mt-1.5 text-xs text-ink-muted">Mínimo 8 caracteres.</p>
          </div>
        )}

        {error && <p role="alert" className="rounded-2xl bg-terracotta-50 px-4 py-2.5 text-sm font-semibold text-terracotta-700">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Un momento…" : register ? "Crear mi cuenta" : "Entrar"}
        </button>
        {!register && (
          <p className="text-center text-sm">
            <Link href={cleanUser && !cleanUser.includes("@") ? `/recuperar?u=${encodeURIComponent(cleanUser)}` : "/recuperar"} className="font-bold text-moss hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
