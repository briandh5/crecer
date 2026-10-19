"use client";

import Link from "next/link";

/** Aviso cuando alguien abre el perfil de otra cuenta con una sesión distinta. */
export function SwitchAccount({ current, requested }: { current: string; requested: string }) {
  async function logoutAndStay() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign(`/${requested}`);
  }
  return (
    <div className="card mx-auto max-w-md space-y-4 text-center">
      <h1 className="text-2xl font-semibold">Este perfil es de @{requested}</h1>
      <p className="text-ink-soft">
        Ahora estás conectado como <strong>@{current}</strong>. Los perfiles son privados: solo su dueño puede verlos.
      </p>
      <div className="flex flex-col gap-2">
        <Link href={`/${current}`} className="btn-primary">Ir a mi perfil</Link>
        <button type="button" onClick={logoutAndStay} className="btn-soft">Salir y entrar como @{requested}</button>
      </div>
    </div>
  );
}
