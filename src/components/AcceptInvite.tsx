"use client";

import { useState } from "react";

export function AcceptInvite({ token, inviter }: { token: string; inviter: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/family/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const body = (await res.json().catch(() => null)) as { error?: string; username?: string } | null;
      if (!res.ok) return setError(body?.error ?? "No se pudo aceptar. Inténtalo de nuevo.");
      window.location.assign(`/${body?.username}`);
    } catch {
      setError("Sin conexión. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-2xl bg-terracotta-50 px-4 py-2.5 text-sm font-semibold text-terracotta-700">{error}</p>}
      <button type="button" className="btn-primary w-full" onClick={accept} disabled={busy}>
        {busy ? "Un momento…" : `Unirme a la familia de @${inviter}`}
      </button>
    </div>
  );
}
