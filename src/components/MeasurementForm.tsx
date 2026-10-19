"use client";

import { useState, type FormEvent } from "react";
import { parseDecimal } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Child } from "@/lib/types";

const RANGES = {
  weight: { min: 0.3, max: 250, label: "El peso", unit: "kg" },
  height: { min: 20, max: 230, label: "La talla", unit: "cm" },
  head: { min: 15, max: 70, label: "El perímetro cefálico", unit: "cm" },
} as const;

/** Captura rápida pensada para la consulta: la fecha ya viene en "hoy" y basta con llenar un dato. */
export function MeasurementForm({ child, onDone }: { child: Child; onDone?: () => void }) {
  const { today, actions } = useStore();
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [head, setHead] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const vals = { weight: parseDecimal(weight), height: parseDecimal(height), head: parseDecimal(head) };

    for (const key of Object.keys(vals) as (keyof typeof vals)[]) {
      const v = vals[key];
      const r = RANGES[key];
      if (v !== null && (Number.isNaN(v) || v < r.min || v > r.max)) {
        return setError(`${r.label} debe estar entre ${r.min} y ${r.max} ${r.unit}.`);
      }
    }
    if (vals.weight === null && vals.height === null && vals.head === null) {
      return setError("Anota al menos una medida: peso, talla o perímetro cefálico.");
    }
    if (!date || date < child.birthDate) return setError("La fecha no puede ser anterior al nacimiento.");
    if (date > today) return setError("La fecha no puede estar en el futuro.");

    actions.addMeasurement({
      childId: child.id,
      measuredAt: date,
      weightKg: vals.weight,
      heightCm: vals.height,
      headCm: vals.head,
      note: note.trim(),
    });
    setWeight("");
    setHeight("");
    setHead("");
    setNote("");
    setError(null);
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="m-weight" className="label">Peso (kg)</label>
          <input id="m-weight" className="field" inputMode="decimal" placeholder="12,8" value={weight} onChange={(e) => setWeight(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="m-height" className="label">Talla (cm)</label>
          <input id="m-height" className="field" inputMode="decimal" placeholder="90" value={height} onChange={(e) => setHeight(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="m-head" className="label">Perímetro cefálico (cm)</label>
          <input id="m-head" className="field" inputMode="decimal" placeholder="48,5" value={head} onChange={(e) => setHead(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="m-date" className="label">Fecha</label>
          <input id="m-date" type="date" className="field" value={date} min={child.birthDate} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor="m-note" className="label">Nota (opcional)</label>
        <input id="m-note" className="field" placeholder="Control de 2 años y 4 meses" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
      </div>
      {error && (
        <p role="alert" className="rounded-2xl bg-terracotta-50 px-4 py-2.5 text-sm font-semibold text-terracotta-700">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full">Guardar medición</button>
    </form>
  );
}
