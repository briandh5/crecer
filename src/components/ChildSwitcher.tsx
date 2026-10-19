"use client";

import Link from "next/link";
import { ageInMonths, formatAge } from "@/lib/date";
import { stageFor } from "@/lib/stage";
import { useStore } from "@/lib/store";
import type { Tone } from "@/lib/types";
import { PlantIcon } from "./PlantIcon";
import { PlusIcon } from "./Icons";

export const TONE_BG: Record<Tone, string> = {
  moss: "bg-moss-100",
  sage: "bg-sage-100",
  terracotta: "bg-terracotta-100",
  sand: "bg-sand-100",
};

/** Cambio rápido de perfil: una fila desplazable de chips, pensada para el pulgar. */
export function ChildSwitcher() {
  const { state, child, today, actions, base } = useStore();

  return (
    <nav aria-label="Perfiles" className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex w-max items-stretch gap-2.5 sm:w-auto sm:flex-wrap">
        {state.children.map((c) => {
          const active = c.id === child?.id;
          const stage = stageFor(ageInMonths(c.birthDate, today));
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => actions.setActive(c.id)}
                aria-pressed={active}
                className={`flex min-h-[56px] items-center gap-2.5 rounded-2xl border py-1.5 pl-1.5 pr-4 text-left transition
                  ${active ? "border-moss bg-white shadow-soft" : "border-transparent bg-white/60 hover:bg-white"}`}
              >
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${TONE_BG[c.tone]}`}>
                  <PlantIcon stage={stage.id} size={34} />
                </span>
                <span>
                  <span className={`block text-sm font-bold leading-tight ${active ? "text-moss" : "text-ink"}`}>{c.name}</span>
                  <span className="block text-xs text-ink-muted">{formatAge(c.birthDate, today)}</span>
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <Link
            href={`${base}/perfil/nuevo`}
            className="flex min-h-[56px] items-center gap-2 rounded-2xl border border-dashed border-sage px-4 text-sm font-bold text-moss transition hover:bg-moss-50"
          >
            <PlusIcon width={18} height={18} /> Agregar
          </Link>
        </li>
      </ul>
    </nav>
  );
}
