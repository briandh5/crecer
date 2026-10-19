"use client";

import { useEffect, useState, type FormEvent } from "react";

interface Props {
  /** Usuario con el que se abre la pantalla (p. ej. al visitar /briandh444). */
  initialUsername?: string;
  /** Si es true, el usuario no se puede cambiar: solo se pide la contraseña. */
  lockUsername?: boolean;
  allowRegister?: boolean;
  defaultTab?: "login" | "register";
}

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

export function AuthPanel({ initialUsername = "", lockUsername = false, allowRegister = true, defaultTab = "login" }: Props) {
  const [tab, setTab] = useState<"login" | "register">(lockUsername ? "login" : defaultTab);
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);

  const register = tab === "register";
  const cleanUser = username.trim().toLowerCase();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!USERNAME_RE.test(cleanUser)) {
      return setError("El usuario debe tener de 3 a 30 caracteres: letras minúsculas, números, «_» o «-», sin espacios ni tildes.");
    }
    if (register) {
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
        body: JSON.stringify({ username: cleanUser, password }),
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

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="a-user" className="label">Usuario</label>
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
            <p className="mt-1.5 text-xs text-ink-muted">Mínimo 8 caracteres. Guárdala bien: por ahora no hay recuperación por correo.</p>
          </div>
        )}

        {error && <p role="alert" className="rounded-2xl bg-terracotta-50 px-4 py-2.5 text-sm font-semibold text-terracotta-700">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Un momento…" : register ? "Crear mi cuenta" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
