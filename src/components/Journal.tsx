"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ageInMonths, formatDate, formatMonths } from "@/lib/date";
import { useStore } from "@/lib/store";
import type { Child, JournalEntry, JournalKind } from "@/lib/types";
import { preparePhoto, PhotoError } from "@/lib/image";
import { PlusIcon, TrashIcon } from "./Icons";
import { Modal } from "./Modal";

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
  const { state, today, actions, mode, photoUrl } = useStore();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<JournalKind>("sonrisa");
  const [title, setTitle] = useState(KINDS[0].title);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Libera la vista previa al cambiarla o al salir.
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.preview) : undefined), [photo]);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPhotoBusy(true);
    try {
      const blob = await preparePhoto(file);
      setPhoto({ blob, preview: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e instanceof PhotoError ? e.message : "No se pudo preparar la foto.");
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const entries = useMemo(
    () => state.journal.filter((j) => j.childId === child.id).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)),
    [state.journal, child.id],
  );

  const readingEntry = entries.find((e) => e.id === reading) ?? null;

  function pickKind(id: JournalKind) {
    setKind(id);
    setTitle(KINDS.find((k) => k.id === id)!.title);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Ponle un título al recuerdo.");
    if (date < child.birthDate) return setError("La fecha no puede ser anterior al nacimiento.");
    if (date > today) return setError("La fecha no puede estar en el futuro.");
    actions.addJournal({ childId: child.id, kind, title: title.trim(), occurredAt: date, note: note.trim() }, photo?.blob);
    setAdding(false);
    setNote("");
    setPhoto(null);
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
            <label htmlFor="j-note" className="label">Carta para {child.name} (opcional)</label>
            <textarea
              id="j-note"
              className="field letter-paper letter-lines min-h-[10rem] resize-y !py-4 !leading-8"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={600}
              placeholder={`${dear(child)}: hoy… (cuéntale qué pasó, dónde estaban y cómo se sintieron, para que lo lea cuando sea grande)`}
            />
            <p className="mt-1 text-right text-xs text-ink-muted">{note.length}/600</p>
          </div>
          <div>
            <span className="label">Foto (opcional)</span>
            {mode === "demo" ? (
              <p className="rounded-2xl bg-linen-100 px-4 py-3 text-sm text-ink-soft">
                Las fotos se guardan solo en cuentas.{" "}
                <Link href="/" className="font-bold text-moss underline underline-offset-2">Crea tu cuenta</Link> para subirlas.
              </p>
            ) : photo ? (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.preview} alt="Vista previa de la foto elegida" className="h-24 w-24 rounded-2xl object-cover shadow-soft" />
                <button type="button" className="btn-ghost" onClick={() => setPhoto(null)}>Quitar foto</button>
              </div>
            ) : (
              <>
                <input ref={fileRef} id="j-photo" type="file" accept="image/*" className="peer sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
                <label htmlFor="j-photo" className="btn-soft cursor-pointer peer-focus-visible:ring-4 peer-focus-visible:ring-sage/40">
                  {photoBusy ? "Preparando foto…" : "Elegir o tomar una foto"}
                </label>
              </>
            )}
          </div>
          {error && <p role="alert" className="rounded-2xl bg-terracotta-50 px-4 py-2.5 text-sm font-semibold text-terracotta-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={photoBusy}>Guardar recuerdo</button>
            <button type="button" className="btn-ghost" onClick={() => { setAdding(false); setError(null); setPhoto(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <div className="card text-center text-ink-soft">
          <p className="font-display text-xl text-moss">El diario de {child.name} está esperando su primer capítulo.</p>
          <p className="mt-1 text-sm">Una sonrisa, una palabra nueva, un paso: lo pequeño se vuelve grande con el tiempo.</p>
        </div>
      ) : (
        <ol className="mx-auto max-w-2xl space-y-8">
          {entries.map((e, i) => (
            <li key={e.id} className={i % 2 ? "sm:rotate-[0.4deg]" : "sm:-rotate-[0.4deg]"}>
              <LetterCard
                child={child}
                entry={e}
                photo={photoUrl(e)}
                confirming={confirmId === e.id}
                onAskDelete={() => setConfirmId(e.id)}
                onCancelDelete={() => setConfirmId(null)}
                onDelete={() => { actions.removeJournal(e.id); setConfirmId(null); }}
                onOpen={() => setReading(e.id)}
              />
            </li>
          ))}
        </ol>
      )}

      <Modal wide open={!!readingEntry} onClose={() => setReading(null)} title={readingEntry ? readingEntry.title : "Carta"}>
        {readingEntry && <Letter child={child} entry={readingEntry} photo={photoUrl(readingEntry)} full />}
      </Modal>
    </div>
  );
}

/** «Querida Sofía» / «Querido Mateo» / «Para Alex». */
function dear(child: Child) {
  return child.sex === "female" ? `Querida ${child.name}` : child.sex === "male" ? `Querido ${child.name}` : `Para ${child.name}`;
}

/** «cuando eras recién nacida» / «cuando tenías 7 meses». */
function whenYouWere(child: Child, occurredAt: string) {
  const months = ageInMonths(child.birthDate, occurredAt);
  if (months === 0) return `cuando eras recién ${child.sex === "female" ? "nacida" : child.sex === "male" ? "nacido" : "nacido/a"}`;
  return `cuando tenías ${formatMonths(months)}`;
}

/** La carta: foto con cinta, sello de fecha y edad, título y la nota en letra manuscrita sobre papel de renglones. */
function Letter({ child, entry, photo, full = false }: { child: Child; entry: JournalEntry; photo: string | null; full?: boolean }) {
  const kind = KINDS.find((k) => k.id === entry.kind) ?? KINDS[KINDS.length - 1];
  return (
    <div className="space-y-4">
      {photo && (
        <div className="relative mx-auto w-full max-w-md pt-3">
          <span className="washi" aria-hidden />
          <div className="rotate-[-1.2deg] rounded-xl bg-white p-2.5 pb-8 shadow-lift">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={`Foto del recuerdo: ${entry.title}`}
              loading="lazy"
              className={`w-full rounded-md bg-linen-100 ${full ? "max-h-[60dvh] object-contain" : "aspect-[4/3] object-cover"}`}
            />
            <p className="mt-2 text-center font-hand text-xl text-ink-soft">{formatDate(entry.occurredAt)}</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-sage-600">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-50 px-2.5 py-1 normal-case tracking-normal text-sage-700">
          <span className={`h-2.5 w-2.5 rounded-full ${kind.dot}`} aria-hidden /> {kind.label}
        </span>
        {!photo && <span>{formatDate(entry.occurredAt)}</span>}
      </div>
      {!full && <h3 className="font-display text-2xl font-semibold leading-tight text-moss">{entry.title}</h3>}
      <div className="letter-paper rounded-2xl px-5 py-4 sm:px-6">
        <p className="letter-lines text-moss">{dear(child)}:</p>
        {entry.note ? (
          <p className={`letter-lines whitespace-pre-line ${full ? "" : "line-clamp-6"}`}>{entry.note}</p>
        ) : (
          <p className="letter-lines text-ink-muted">Este día también es parte de tu historia.</p>
        )}
        <p className="letter-lines mt-2 text-right">Con todo nuestro amor, {whenYouWere(child, entry.occurredAt)} ♡</p>
      </div>
    </div>
  );
}

function LetterCard(props: {
  child: Child;
  entry: JournalEntry;
  photo: string | null;
  confirming: boolean;
  onAskDelete(): void;
  onCancelDelete(): void;
  onDelete(): void;
  onOpen(): void;
}) {
  const { child, entry, photo, confirming } = props;
  return (
    <article className="relative rounded-[1.75rem] border border-sand-100 bg-[#fffaf1] p-5 shadow-soft transition hover:rotate-0 hover:shadow-lift sm:p-7">
      <Letter child={child} entry={entry} photo={photo} />
      <div className="mt-4 flex items-center justify-between gap-2">
        <button type="button" className="btn-soft !min-h-[40px]" onClick={props.onOpen}>Abrir carta</button>
        {confirming ? (
          <span className="inline-flex shrink-0 gap-1">
            <button type="button" className="btn-danger !min-h-[36px] !px-3 text-xs" onClick={props.onDelete}>Borrar</button>
            <button type="button" className="btn-ghost !min-h-[36px] !px-3 text-xs" onClick={props.onCancelDelete}>No</button>
          </span>
        ) : (
          <button type="button" className="btn-ghost !min-h-[40px] !px-2.5 text-ink-muted" aria-label={`Borrar recuerdo: ${entry.title}`} onClick={props.onAskDelete}>
            <TrashIcon width={18} height={18} />
          </button>
        )}
      </div>
    </article>
  );
}
