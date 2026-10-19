"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { BookIcon, ChartIcon, HomeIcon, ShieldIcon, SproutIcon } from "./Icons";
import { PlantIcon } from "./PlantIcon";

const NAV = [
  { path: "", label: "Inicio", Icon: HomeIcon },
  { path: "/crecimiento", label: "Crecimiento", Icon: ChartIcon },
  { path: "/vacunas", label: "Vacunas", Icon: ShieldIcon },
  { path: "/hitos", label: "Hitos", Icon: SproutIcon },
  { path: "/diario", label: "Diario", Icon: BookIcon },
] as const;

function isActive(pathname: string, base: string, path: string) {
  const href = base + path;
  return path === "" ? pathname === href : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, ready, mode, username, base, sync, actions } = useStore();

  const account =
    mode === "remote" ? (
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-full bg-white/80 px-3 py-1.5 font-bold text-moss shadow-soft">@{username}</span>
        <button type="button" onClick={actions.logout} className="rounded-full px-3 py-1.5 font-bold text-ink-soft underline-offset-2 hover:underline">
          Salir
        </button>
      </div>
    ) : (
      <Link href="/" className="btn-soft !min-h-[40px] !px-4">Crear cuenta</Link>
    );

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col lg:flex-row lg:gap-8 lg:px-6">
      {/* Barra lateral (escritorio) */}
      <aside className="hidden w-60 shrink-0 py-8 lg:block">
        <div className="sticky top-8 space-y-8">
          <Link href={base} className="flex items-center gap-2.5">
            <PlantIcon stage="arbolito" size={44} />
            <span className="font-display text-2xl font-bold text-moss">Crecer</span>
          </Link>
          <nav aria-label="Secciones">
            <ul className="space-y-1.5">
              {NAV.map(({ path, label, Icon }) => {
                const active = isActive(pathname, base, path);
                return (
                  <li key={path}>
                    <Link
                      href={base + path}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-[48px] items-center gap-3 rounded-2xl px-4 text-sm font-bold transition
                        ${active ? "bg-moss text-white shadow-soft" : "text-ink-soft hover:bg-white/80"}`}
                    >
                      <Icon /> {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div>{account}</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera (móvil) */}
        <header className="flex items-center justify-between gap-3 px-4 pb-1 pt-5 lg:hidden">
          <Link href={base} className="flex items-center gap-2">
            <PlantIcon stage="arbolito" size={34} />
            <span className="font-display text-xl font-bold text-moss">Crecer</span>
          </Link>
          {account}
        </header>

        {ready && mode === "demo" && state.demo && (
          <div role="status" className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl bg-straw-100 px-4 py-2.5 text-sm text-straw-700 lg:mx-0 lg:mt-6">
            <span>
              <strong>Modo demo:</strong> datos de ejemplo guardados solo en este dispositivo.{" "}
              <Link href="/" className="font-bold underline underline-offset-2 hover:text-moss">Crea tu cuenta</Link> para conservarlos en cualquier lugar.
            </span>
            <button type="button" onClick={actions.clearDemo} className="font-bold underline underline-offset-2 hover:text-moss">
              Borrar ejemplos
            </button>
          </div>
        )}

        {mode === "remote" && sync.error && (
          <div role="alert" className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-terracotta-50 px-4 py-3 text-sm font-semibold text-terracotta-700 lg:mx-0 lg:mt-6">
            <span>
              {sync.error} Mostramos de nuevo lo que sí está guardado.
            </span>
            {sync.sessionExpired ? (
              <button type="button" onClick={() => window.location.reload()} className="btn-danger !min-h-[40px]">Iniciar sesión</button>
            ) : (
              <button type="button" onClick={sync.dismissError} className="btn-danger !min-h-[40px]">Entendido</button>
            )}
          </div>
        )}

        <main className="flex-1 px-4 pb-28 pt-5 lg:px-0 lg:pb-12 lg:pt-8">{children}</main>

        {mode === "remote" && sync.pending > 0 && (
          <p role="status" className="fixed bottom-24 right-4 z-40 rounded-full bg-moss px-4 py-2 text-xs font-bold text-white shadow-lift lg:bottom-6 lg:right-6">
            Guardando…
          </p>
        )}
      </div>

      {/* Barra inferior (móvil) */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-linen-200 bg-linen/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ path, label, Icon }) => {
            const active = isActive(pathname, base, path);
            return (
              <li key={path}>
                <Link
                  href={base + path}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition
                    ${active ? "text-moss" : "text-ink-muted"}`}
                >
                  <span className={`grid h-8 w-14 place-items-center rounded-full transition ${active ? "bg-moss-100" : ""}`}>
                    <Icon />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
