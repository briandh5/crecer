"use client";

import { useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import { PasswordField } from "./PasswordField";

async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => null)) as ({ error?: string } & Record<string, unknown>) | null;
    return res.ok ? { ok: true, data: data ?? {} } : { ok: false, error: data?.error ?? "No se pudo guardar." };
  } catch {
    return { ok: false, error: "Sin conexión. Revisa tu internet e inténtalo de nuevo." };
  }
}

function Msg({ ok, text }: { ok: boolean; text: string | null }) {
  if (!text) return null;
  return (
    <p role={ok ? "status" : "alert"} className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${ok ? "bg-moss-50 text-moss" : "bg-terracotta-50 text-terracotta-700"}`}>
      {text}
    </p>
  );
}

export function AccountSettings() {
  const { username, email, setEmail, mode } = useStore();

  const [newEmail, setNewEmail] = useState("");
  const [emailPass, setEmailPass] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  if (mode !== "remote") return <p className="text-ink-soft">La cuenta solo está disponible al entrar con usuario y contraseña.</p>;

  async function saveEmail(e: FormEvent) {
    e.preventDefault();
    setEmailMsg(null);
    setEmailBusy(true);
    const r = await post("/api/account/email", { password: emailPass, email: newEmail });
    setEmailBusy(false);
    if (!r.ok) return setEmailMsg({ ok: false, text: r.error! });
    setEmail(String(r.data?.email));
    setNewEmail("");
    setEmailPass("");
    setEmailMsg({ ok: true, text: "Correo guardado." });
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (next.length < 8) return setPwMsg({ ok: false, text: "La contraseña nueva debe tener al menos 8 caracteres." });
    if (next !== confirm) return setPwMsg({ ok: false, text: "Las contraseñas nuevas no coinciden." });
    setPwBusy(true);
    const r = await post("/api/account/password", { current, next });
    setPwBusy(false);
    if (!r.ok) return setPwMsg({ ok: false, text: r.error! });
    setCurrent("");
    setNext("");
    setConfirm("");
    setPwMsg({ ok: true, text: "Contraseña cambiada. Cerramos tus sesiones en otros dispositivos." });
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4" aria-labelledby="acc-email">
        <div>
          <h2 id="acc-email" className="text-xl font-semibold">Correo de recuperación</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {email ? (
              <>Si olvidas tu contraseña, te enviaremos el enlace a <strong className="break-all text-ink">{email}</strong>.</>
            ) : (
              <strong className="text-terracotta-700">Tu cuenta no tiene correo: si olvidas la contraseña no podrás recuperarla. Agrégalo aquí.</strong>
            )}
          </p>
        </div>
        <form onSubmit={saveEmail} className="space-y-4" noValidate>
          <div>
            <label htmlFor="acc-new-email" className="label">{email ? "Cambiar a otro correo" : "Correo electrónico"}</label>
            <input id="acc-new-email" className="field" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="nombre@correo.com" />
          </div>
          <PasswordField id="acc-email-pass" label="Tu contraseña actual (para confirmar)" value={emailPass} onChange={setEmailPass} autoComplete="current-password" />
          <Msg ok={emailMsg?.ok ?? false} text={emailMsg?.text ?? null} />
          <button type="submit" className="btn-primary" disabled={emailBusy}>{emailBusy ? "Guardando…" : "Guardar correo"}</button>
        </form>
      </section>

      <section className="card space-y-4" aria-labelledby="acc-pass">
        <h2 id="acc-pass" className="text-xl font-semibold">Cambiar contraseña</h2>
        <form onSubmit={savePassword} className="space-y-4" noValidate>
          <input type="text" name="username" value={username} autoComplete="username" readOnly hidden aria-hidden tabIndex={-1} />
          <PasswordField id="acc-cur" label="Contraseña actual" value={current} onChange={setCurrent} autoComplete="current-password" />
          <PasswordField id="acc-new" label="Contraseña nueva" value={next} onChange={setNext} autoComplete="new-password" hint="Mínimo 8 caracteres." />
          <PasswordField id="acc-new2" label="Repite la contraseña nueva" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          <Msg ok={pwMsg?.ok ?? false} text={pwMsg?.text ?? null} />
          <button type="submit" className="btn-primary" disabled={pwBusy}>{pwBusy ? "Guardando…" : "Cambiar contraseña"}</button>
        </form>
      </section>
    </div>
  );
}
