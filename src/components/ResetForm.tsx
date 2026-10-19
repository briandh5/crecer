"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { PasswordField } from "./PasswordField";

export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // El token ya está en memoria: lo quitamos de la barra de direcciones para que no quede en el historial.
  useEffect(() => {
    window.history.replaceState(null, "", "/restablecer");
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; username?: string } | null;
      if (!res.ok) return setError(body?.error ?? "No se pudo cambiar la contraseña.");
      setDone(body?.username ?? "");
    } catch {
      setError("Sin conexión. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (done !== null) {
    return (
      <div className="card w-full max-w-md space-y-4 text-center" role="status">
        <h2 className="text-2xl font-semibold">Contraseña cambiada</h2>
        <p className="text-ink-soft">Ya puedes entrar con tu contraseña nueva. Por seguridad, cerramos tus sesiones abiertas en otros dispositivos.</p>
        <Link href={done ? `/${done}` : "/"} className="btn-primary">Entrar</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-md space-y-4" noValidate>
      <PasswordField id="r-pass" label="Contraseña nueva" value={password} onChange={setPassword} autoComplete="new-password" hint="Mínimo 8 caracteres." autoFocus />
      <PasswordField id="r-pass2" label="Repite la contraseña" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {error && (
        <p role="alert" className="rounded-2xl bg-terracotta-50 px-4 py-2.5 text-sm font-semibold text-terracotta-700">
          {error}{" "}
          {/(enlace|venci)/i.test(error) && <Link href="/recuperar" className="underline">Pedir uno nuevo</Link>}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? "Guardando…" : "Guardar contraseña nueva"}</button>
    </form>
  );
}
