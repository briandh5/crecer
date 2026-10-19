"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ageInMonths, formatDate, formatMonths } from "@/lib/date";
import { useStore } from "@/lib/store";
import type { Child, JournalKind } from "@/lib/types";
import { PlusIcon, TrashIcon } from "./Icons";

export const KINDS: { id: JournalKind; label: string; title: string; dot: string }[] = [
  { id: "sonrisa", label: "Primera sonrisa", title: "Primera sonrisa", dot: "bg-straw" },
  { id: "volteo", label: "Primer volteo", title: "Se dio la vuelta", dot: "bg-sage" },
  { id: "palabra", label: "Primera palabra", title: "Primera palabra: ", dot: "bg-terracotta-300" },
  { id: "pasos", label: "Primeros pasos", title: "Primeros pasos", dot: "bg-moss-300" },
  { id: "diente", label: "Primer diente", title: "Primer diente", dot: "bg-sand" },
  { id: "escuela", label: "Escuela", title: "Primer día de escuela", dot: "bg-moss-400" },
  { id: "otro", label: "Otro momento", title: "", dot: "bg-sand-400" },
];

export function Journal({ child }: { child: Child }) {
  const { state, today, actions } = useStore();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<JournalKind>("sonrisa");
  const [title, setTitle] = useState(KINDS[0].title);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const entries = useMemo(
    () => state.journal.filter((j) => j.childId === child.id).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)),
    [state.journal, child.id],
  );

  function pickKind(id: JournalKind) {
    setKind(id);
    setTitle(KINDS.find((k) => k.id === id)!.title);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Ponle un título al recuerdo.");
    if (date < child.birthDate) return setError("La fecha no puede ser anterior al nacimiento.");
    if (date > today) return setError("La fecha no puede estar en el futuro.");
    actions.addJournal({ childId: child.id, kind, title: title.trim(), occurredAt: date, note: note.trim() });
    setAdding(false);
    setNote("");
    setError(null);
    setDate(today);
  }

  return (
    <div className="space-y-6">
      {!adding ? (
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
          <PlusIcon width={18} height={18} /> Nuevo recuerdo
        </button>
      ) : (
        <form onSubmit={submit} className="card animate-grow space-y-4" noValidate aria-label="Nuevo recuerdo">
          <fieldset>
            <legend className="label">¿Qué pasó?</legend>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={kind === k.id}
                  onClick={() => pickKind(k.id)}
                  className={`min-h-[40px] rounded-full px-4 text-sm font-bold transition ${kind === k.id ? "bg-moss text-white" : "bg-linen-100 text-ink-soft hover:bg-moss-50"}`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <div>
              <label htmlFor="j-title" className="label">Título</label>
              <input id="j-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Primera palabra: «mamá»" />
            </div>
            <div>
              <label htmlFor="j-date" className="label">Fecha</label>
              <input id="j-date" type="date" className="field" value={date} min={child.birthDate} max={today} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="j-note" className="label">Notas (opcional)</label>
            <textarea id="j-note" className="field min-h-[96px] resize-y" value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} placeholder="Dónde estaban, qué dijo, cómo reaccionaron…" />
          </div>
          {error && <p role="alert" className="rounded-2xl bg-terracotta-50 px-4 py-2.5 text-sm font-semibold text-terracotta-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Guardar recuerdo</button>
            <button type="button" className="btn-ghost" onClick={() => { setAdding(false); setError(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <div className="card text-center text-ink-soft">
          <p className="font-display text-xl text-moss">El diario de {child.name} está esperando su primer capítulo.</p>
          <p className="mt-1 text-sm">Una sonrisa, una palabra nueva, un paso: lo pequeño se vuelve grande con el tiempo.</p>
        </div>
      ) : (
        <ol className="relative space-y-5 border-l-2 border-dashed border-sage/50 pl-6 sm:pl-8">
          {entries.map((e) => {
            const kindInfo = KINDS.find((k) => k.id === e.kind) ?? KINDS[KINDS.length - 1];
            const ageAt = ageInMonths(child.birthDate, e.occurredAt);
            return (
              <li key={e.id} className="relative">
                <span className={`absolute -left-[2.15rem] top-5 h-4 w-4 rounded-full border-[3px] border-linen sm:-left-[2.65rem] ${kindInfo.dot}`} aria-hidden />
                <article className="card !p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-sage-600">
                        {formatDate(e.occurredAt)} · {ageAt === 0 ? "recién nacido/a" : `a los ${formatMonths(ageAt)}`}
                      </p>
                      <h3 className="mt-0.5 text-xl font-semibold">{e.title}</h3>
                    </div>
                    {confirmId === e.id ? (
                      <span className="inline-flex shrink-0 gap-1">
                        <button type="button" className="btn-danger !min-h-[36px] !px-3 text-xs" onClick={() => { actions.removeJournal(e.id); setConfirmId(null); }}>Borrar</button>
                        <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-xs" onClick={() => setConfirmId(null)}>No</button>
                      </span>
                    ) : (
                      <button type="button" className="btn-ghost !min-h-[40px] !px-2.5 text-ink-muted" aria-label={`Borrar recuerdo: ${e.title}`} onClick={() => setConfirmId(e.id)}>
                        <TrashIcon width={18} height={18} />
                      </button>
                    )}
                  </div>
                  {e.note && <p className="mt-2 whitespace-pre-line text-ink-soft">{e.note}</p>}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
