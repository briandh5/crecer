"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { BookIcon, ChartIcon, HomeIcon, ShieldIcon, SproutIcon } from "./Icons";
import { PlantIcon } from "./PlantIcon";

const NAV = [
  { href: "/", label: "Inicio", Icon: HomeIcon },
  { href: "/crecimiento", label: "Crecimiento", Icon: ChartIcon },
  { href: "/vacunas", label: "Vacunas", Icon: ShieldIcon },
  { href: "/hitos", label: "Hitos", Icon: SproutIcon },
  { href: "/diario", label: "Diario", Icon: BookIcon },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, ready, actions } = useStore();

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col lg:flex-row lg:gap-8 lg:px-6">
      {/* Barra lateral (escritorio) */}
      <aside className="hidden w-60 shrink-0 py-8 lg:block">
        <div className="sticky top-8 space-y-8">
          <Link href="/" className="flex items-center gap-2.5">
            <PlantIcon stage="arbolito" size={44} />
            <span className="font-display text-2xl font-bold text-moss">Crecer</span>
          </Link>
          <nav aria-label="Secciones">
            <ul className="space-y-1.5">
              {NAV.map(({ href, label, Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
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
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera (móvil) */}
        <header className="flex items-center justify-between px-4 pb-1 pt-5 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <PlantIcon stage="arbolito" size={34} />
            <span className="font-display text-xl font-bold text-moss">Crecer</span>
          </Link>
        </header>

        {ready && state.demo && (
          <div role="status" className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl bg-straw-100 px-4 py-2.5 text-sm text-straw-700 lg:mx-0 lg:mt-6">
            <span>
              <strong>Modo demo:</strong> datos de ejemplo guardados solo en este dispositivo.
            </span>
            <button type="button" onClick={actions.clearDemo} className="font-bold underline underline-offset-2 hover:text-moss">
              Borrar ejemplos y empezar
            </button>
          </div>
        )}

        <main className="flex-1 px-4 pb-28 pt-5 lg:px-0 lg:pb-12 lg:pt-8">{children}</main>
      </div>

      {/* Barra inferior (móvil) */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-linen-200 bg-linen/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
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
