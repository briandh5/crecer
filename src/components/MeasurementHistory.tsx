"use client";

import { useState } from "react";
import { formatAge, formatDate } from "@/lib/date";
import { num } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Child } from "@/lib/types";
import { TrashIcon } from "./Icons";

/** Tabla del historial; además de dar detalle, es la alternativa en texto de la gráfica. */
export function MeasurementHistory({ child }: { child: Child }) {
  const { state, actions } = useStore();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const rows = state.measurements
    .filter((m) => m.childId === child.id)
    .sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1));

  if (!rows.length) return <p className="text-sm text-ink-muted">Todavía no hay mediciones.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-left text-sm">
        <caption className="sr-only">Historial de mediciones de {child.name}</caption>
        <thead>
          <tr className="border-b border-linen-200 text-xs uppercase tracking-wide text-ink-muted">
            <th scope="col" className="py-2 pr-3 font-bold">Fecha</th>
            <th scope="col" className="py-2 pr-3 font-bold">Edad</th>
            <th scope="col" className="py-2 pr-3 text-right font-bold">Peso</th>
            <th scope="col" className="py-2 pr-3 text-right font-bold">Talla</th>
            <th scope="col" className="py-2 pr-3 text-right font-bold">P. cefálico</th>
            <th scope="col" className="w-10 py-2"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b border-linen-200/70 last:border-0">
              <td className="py-3 pr-3 font-semibold">
                {formatDate(m.measuredAt)}
                {m.source === "birth" && <span className="pill ml-2 bg-straw-100 text-straw-700">Nacimiento</span>}
                {m.note && m.source !== "birth" && <span className="block text-xs font-normal text-ink-muted">{m.note}</span>}
              </td>
              <td className="py-3 pr-3 text-ink-soft">
                {m.measuredAt === child.birthDate ? "Al nacer" : formatAge(child.birthDate, m.measuredAt)}
              </td>
              <td className="py-3 pr-3 text-right tabular-nums">{m.weightKg != null ? `${num(m.weightKg, 2)} kg` : "—"}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{m.heightCm != null ? `${num(m.heightCm, 1)} cm` : "—"}</td>
              <td className="py-3 pr-3 text-right tabular-nums">{m.headCm != null ? `${num(m.headCm, 1)} cm` : "—"}</td>
              <td className="py-3 text-right">
                {m.source === "manual" &&
                  (confirmId === m.id ? (
                    <span className="inline-flex gap-1">
                      <button
                        type="button"
                        className="btn-danger !min-h-[36px] !px-3 text-xs"
                        onClick={() => {
                          actions.removeMeasurement(m.id);
                          setConfirmId(null);
                        }}
                      >
                        Borrar
                      </button>
                      <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-xs" onClick={() => setConfirmId(null)}>
                        No
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="btn-ghost !min-h-[36px] !px-2 text-ink-muted" aria-label={`Borrar medición del ${formatDate(m.measuredAt)}`} onClick={() => setConfirmId(m.id)}>
                      <TrashIcon width={18} height={18} />
                    </button>
                  ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
