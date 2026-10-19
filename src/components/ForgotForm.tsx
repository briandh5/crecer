"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export function ForgotForm({ initial = "" }: { initial?: string }) {
  const [identifier, setIdentifier] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim()) return setError("Escribe tu usuario o tu correo.");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        return setError(body?.error ?? "No se pudo enviar. Inténtalo de nuevo.");
      }
      setSent(true);
    } catch {
      setError("Sin conexión. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="card w-full max-w-md space-y-4 text-center" role="status">
        <h2 className="text-2xl font-semibold">Revisa tu correo</h2>
        <p className="text-ink-soft">
          Si existe una cuenta con ese dato, te enviamos un enlace para elegir una contraseña nueva. Vale 60 minutos. Si no lo ves, mira en la carpeta de spam.
        </p>
        <Link href="/" className="btn-soft">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-md space-y-4" noValidate>
      <div>
        <label htmlFor="f-id" className="label">Usuario o correo</label>
        <input
          id="f-id"
          className="field"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={254}
          autoFocus
        />
        <p className="mt-1.5 text-xs text-ink-muted">Te enviaremos el enlace al correo con el que creaste la cuenta.</p>
      </div>
      {error && <p role="alert" className="rounded-2xl bg-terracotta-50 px-4 py-2.5 text-sm font-semibold text-terracotta-700">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? "Enviando…" : "Enviarme el enlace"}</button>
      <p className="text-center text-sm"><Link href="/" className="font-bold text-moss hover:underline">Volver</Link></p>
    </form>
  );
}
