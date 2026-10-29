"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";

interface FamilyInfo {
  members: { id: string; username: string; email: string | null }[];
  pending: { email: string; expiresAt: string }[];
}

async function call(url: string, init?: RequestInit): Promise<{ ok: true; info: FamilyInfo } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
    const data = (await res.json().catch(() => null)) as (FamilyInfo & { error?: string }) | null;
    return res.ok && data ? { ok: true, info: data } : { ok: false, error: data?.error ?? "No se pudo completar." };
  } catch {
    return { ok: false, error: "Sin conexión. Revisa tu internet e inténtalo de nuevo." };
  }
}

const post = (url: string, body: unknown) => call(url, { method: "POST", body: JSON.stringify(body) });

/** «Familia»: invitar por correo a otra persona para compartir los perfiles de los hijos. */
export function FamilySettings() {
  const { mode } = useStore();
  const [info, setInfo] = useState<FamilyInfo | null>(null);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "remote") return;
    void call("/api/family").then((r) => (r.ok ? setInfo(r.info) : setMsg({ ok: false, text: r.error })));
  }, [mode]);

  if (mode !== "remote") return null;

  async function run(p: Promise<Awaited<ReturnType<typeof call>>>, okText: string) {
    setBusy(true);
    setMsg(null);
    const r = await p;
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error }), false;
    setInfo(r.info);
    setMsg({ ok: true, text: okText });
    return true;
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    const to = email.trim().toLowerCase();
    if (await run(post("/api/family/invite", { email: to }), `Invitación enviada a ${to}. Vale 7 días.`)) setEmail("");
  }

  return (
    <section className="card space-y-4" aria-labelledby="acc-family">
      <div>
        <h2 id="acc-family" className="text-xl font-semibold">Familia</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Invita a tu pareja u otra persona de confianza: las dos cuentas verán los perfiles de los hijos de ambas y podrán añadir mediciones, vacunas, hitos y recuerdos. Solo quien creó un perfil puede borrarlo.
        </p>
      </div>

      {info && info.members.length > 0 && (
        <ul className="divide-y divide-linen-200 rounded-2xl border border-linen-200">
          {info.members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>
                <strong>@{m.username}</strong>
                {m.email && <span className="block break-all text-xs text-ink-muted">{m.email}</span>}
              </span>
              {confirmId === m.id ? (
                <span className="flex gap-2">
                  <button type="button" className="btn-danger !min-h-[36px] !px-3 text-xs" disabled={busy} onClick={() => void run(post("/api/family/remove", { id: m.id }), `@${m.username} ya no está en tu familia.`).then(() => setConfirmId(null))}>
                    Quitar
                  </button>
                  <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-xs" onClick={() => setConfirmId(null)}>Cancelar</button>
                </span>
              ) : (
                <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-xs" onClick={() => setConfirmId(m.id)}>Quitar de la familia</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {info && info.pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Invitaciones pendientes</p>
          <ul className="space-y-2">
            {info.pending.map((p) => (
              <li key={p.email} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-linen-100 px-4 py-2.5 text-sm">
                <span className="break-all">{p.email}</span>
                <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-xs" disabled={busy} onClick={() => void run(post("/api/family/cancel", { email: p.email }), "Invitación anulada.")}>
                  Anular
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={invite} className="space-y-4" noValidate>
        <div>
          <label htmlFor="fam-email" className="label">Correo de la persona que quieres invitar</label>
          <input id="fam-email" className="field" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" />
        </div>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${msg.ok ? "bg-moss-50 text-moss" : "bg-terracotta-50 text-terracotta-700"}`}>
            {msg.text}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy || !email.trim()}>{busy ? "Un momento…" : "Enviar invitación"}</button>
      </form>
    </section>
  );
}
