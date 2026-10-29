"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "./Icons";

interface Props {
  photo: { src: string; title: string; date: string; note: string } | null;
  onClose: () => void;
}

/** Foto en grande con su descripción. Se cierra con la X, con Esc o tocando fuera del recuadro. */
export function PhotoViewer({ photo, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (photo && !dlg.open) dlg.showModal();
    if (!photo && dlg.open) dlg.close();
  }, [photo]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => (e.target === ref.current || e.target === frame.current) && onClose()}
      aria-label={photo ? `Foto: ${photo.title}` : "Foto"}
      className="!m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-transparent p-0 text-ink backdrop:bg-ink/55 backdrop:backdrop-blur-sm"
    >
      {photo && (
        <div ref={frame} className="flex min-h-full items-center justify-center p-3 sm:p-6">
          <figure className="relative w-full max-w-3xl animate-grow rounded-2xl bg-white p-3 pb-5 shadow-lift sm:p-4 sm:pb-6">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar foto"
              className="absolute right-2 top-2 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow-soft transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sage/40 sm:right-3 sm:top-3"
            >
              <CloseIcon />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.src} alt={`Foto del recuerdo: ${photo.title}`} className="mx-auto max-h-[70dvh] w-auto rounded-lg bg-linen-100 object-contain" />
            <figcaption className="mt-4 px-1 text-center sm:px-4">
              <p className="font-hand text-xl text-ink-muted">{photo.date}</p>
              <p className="font-display text-2xl font-semibold leading-tight text-moss">{photo.title}</p>
              {photo.note && <p className="mx-auto mt-2 max-w-xl whitespace-pre-line font-hand text-[1.4rem] leading-snug text-ink-soft">{photo.note}</p>}
            </figcaption>
          </figure>
        </div>
      )}
    </dialog>
  );
}
