"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { parseDecimal } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { BloodType, Child, Sex, Tone } from "@/lib/types";
import { TONE_BG } from "./ChildSwitcher";

const BLOOD: { id: BloodType; label: string }[] = [
  { id: "unknown", label: "No lo sé" },
  ...(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const).map((b) => ({ id: b, label: b.replace("-", "−") })),
];

const SEX: { id: Sex; label: string }[] = [
  { id: "female", label: "Niña" },
  { id: "male", label: "Niño" },
  { id: "unspecified", label: "Prefiero no indicar" },
];

const TONES: { id: Tone; label: string }[] = [
  { id: "moss", label: "Musgo" },
  { id: "sage", label: "Salvia" },
  { id: "terracotta", label: "Terracota" },
  { id: "sand", label: "Arena" },
];

/** Ficha de crecimiento inicial: sirve para crear un perfil nuevo o editar uno existente. */
export function ChildForm({ child }: { child?: Child }) {
  const router = useRouter();
  const { today, actions, base } = useStore();
  const editing = !!child;

  const [name, setName] = useState(child?.name ?? "");
  const [birthDate, setBirthDate] = useState(child?.birthDate ?? "");
  const [sex, setSex] = useState<Sex>(child?.sex ?? "unspecified");
  const [tone, setTone] = useState<Tone | undefined>(child?.tone);
  const [weight, setWeight] = useState(child?.birthWeightKg?.toString().replace(".", ",") ?? "");
  const [length, setLength] = useState(child?.birthLengthCm?.toString().replace(".", ",") ?? "");
  const [head, setHead] = useState(child?.birthHeadCm?.toString().replace(".", ",") ?? "");
  const [blood, setBlood] = useState<BloodType>(child?.bloodType ?? "unknown");
  const [allergies, setAllergies] = useState(child?.allergies.join(", ") ?? "");
  const [notes, setNotes] = useState(child?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const w = parseDecimal(weight);
    const l = parseDecimal(length);
    const h = parseDecimal(head);
    if (!name.trim()) return setError("Escribe el nombre.");
    if (!birthDate) return setError("Indica la fecha de nacimiento.");
    if (birthDate > today) return setError("La fecha de nacimiento no puede estar en el futuro.");
    if (w !== null && (Number.isNaN(w) || w < 0.3 || w > 10)) return setError("El peso al nacer debe estar entre 0,3 y 10 kg.");
    if (l !== null && (Number.isNaN(l) || l < 20 || l > 70)) return setError("La talla al nacer debe estar entre 20 y 70 cm.");
    if (h !== null && (Number.isNaN(h) || h < 15 || h > 50)) return setError("El perímetro cefálico al nacer debe estar entre 15 y 50 cm.");

    const data = {
      name: name.trim(),
      birthDate,
      sex,
      bloodType: blood,
      allergies: allergies.split(",").map((a) => a.trim()).filter(Boolean),
      notes: notes.trim(),
      birthWeightKg: w,
      birthLengthCm: l,
      birthHeadCm: h,
    };

    if (child) {
      actions.updateChild(child.id, { ...data, ...(tone ? { tone } : {}) });
      router.push(base);
    } else {
      actions.addChild({ ...data, tone });
      router.push(base);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <section className="card space-y-4">
        <h2 className="text-xl font-semibold">Datos básicos</h2>
        <div>
          <label htmlFor="c-name" className="label">Nombre</label>
          <input id="c-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="c-birth" className="label">Fecha de nacimiento</label>
            <input id="c-birth" type="date" className="field" value={birthDate} max={today} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="c-sex" className="label">Sexo (para las curvas de referencia)</label>
            <select id="c-sex" className="field" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
              {SEX.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="label">Color del perfil</legend>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <label key={t.id} className="cursor-pointer">
                <input type="radio" name="tone" className="peer sr-only" checked={tone === t.id} onChange={() => setTone(t.id)} />
                <span className={`flex min-h-[44px] items-center gap-2 rounded-2xl border-2 border-transparent px-3.5 text-sm font-bold text-ink-soft peer-checked:border-moss peer-focus-visible:ring-4 peer-focus-visible:ring-sage/40 ${TONE_BG[t.id]}`}>
                  {t.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Al nacer</h2>
          <p className="text-sm text-ink-muted">Son el primer punto de la curva de crecimiento. Puedes dejarlos vacíos y completarlos después.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="c-w" className="label">Peso (kg)</label>
            <input id="c-w" className="field" inputMode="decimal" placeholder="3,2" value={weight} onChange={(e) => setWeight(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="c-l" className="label">Talla (cm)</label>
            <input id="c-l" className="field" inputMode="decimal" placeholder="50" value={length} onChange={(e) => setLength(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="c-h" className="label">Perímetro cefálico (cm)</label>
            <input id="c-h" className="field" inputMode="decimal" placeholder="34" value={head} onChange={(e) => setHead(e.target.value)} autoComplete="off" />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-semibold">Salud</h2>
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <div>
            <label htmlFor="c-blood" className="label">Tipo de sangre</label>
            <select id="c-blood" className="field" value={blood} onChange={(e) => setBlood(e.target.value as BloodType)}>
              {BLOOD.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="c-all" className="label">Alergias (separadas por comas)</label>
            <input id="c-all" className="field" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Penicilina, cacahuate" autoComplete="off" />
          </div>
        </div>
        <div>
          <label htmlFor="c-notes" className="label">Notas especiales</label>
          <textarea id="c-notes" className="field min-h-[96px] resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Condiciones, medicamentos habituales, indicaciones del pediatra…" />
        </div>
      </section>

      {error && <p role="alert" className="rounded-2xl bg-terracotta-50 px-4 py-3 text-sm font-semibold text-terracotta-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary">{editing ? "Guardar cambios" : "Crear perfil"}</button>
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancelar</button>
        {editing && (
          <span className="ml-auto">
            {confirmDelete ? (
              <span className="inline-flex gap-2">
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    actions.removeChild(child.id);
                    router.push(base);
                  }}
                >
                  Sí, borrar todo el perfil
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)}>No</button>
              </span>
            ) : (
              <button type="button" className="btn-ghost text-terracotta-700" onClick={() => setConfirmDelete(true)}>Borrar perfil</button>
            )}
          </span>
        )}
      </div>
    </form>
  );
}
