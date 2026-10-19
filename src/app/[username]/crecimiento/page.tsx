"use client";

import { useState } from "react";
import { GrowthChart } from "@/components/GrowthChart";
import { MeasurementForm } from "@/components/MeasurementForm";
import { MeasurementHistory } from "@/components/MeasurementHistory";
import { Modal } from "@/components/Modal";
import { ChildPage } from "@/components/Page";
import { PlusIcon } from "@/components/Icons";
import { formatDate } from "@/lib/date";
import { num } from "@/lib/format";
import { useStore } from "@/lib/store";
import Link from "next/link";

const BLOOD_LABEL = (b: string) => (b === "unknown" ? "No registrado" : b.replace("-", "−"));

export default function GrowthPage() {
  const { state, base } = useStore();
  const [adding, setAdding] = useState(false);

  return (
    <ChildPage title="Crecimiento" intro="La curva de peso y talla de tu peque, comparada con la mediana de referencia.">
      {(child) => (
        <>
          <section className="card" aria-labelledby="chart-title">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="chart-title" className="text-xl font-semibold">Evolución</h2>
              <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
                <PlusIcon width={18} height={18} /> Nueva medición
              </button>
            </div>
            <GrowthChart child={child} measurements={state.measurements} />
          </section>

          <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
            <section className="card" aria-labelledby="hist-title">
              <h2 id="hist-title" className="mb-3 text-xl font-semibold">Historial de mediciones</h2>
              <MeasurementHistory child={child} />
            </section>

            <section className="card space-y-3" aria-labelledby="ficha-title">
              <div className="flex items-center justify-between gap-2">
                <h2 id="ficha-title" className="text-xl font-semibold">Ficha de nacimiento</h2>
                <Link href={`${base}/perfil`} className="text-sm font-bold text-moss hover:underline">Editar</Link>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-ink-muted">Nació el</dt>
                <dd className="font-semibold">{formatDate(child.birthDate)}</dd>
                <dt className="text-ink-muted">Peso</dt>
                <dd className="font-semibold">{child.birthWeightKg != null ? `${num(child.birthWeightKg, 2)} kg` : "—"}</dd>
                <dt className="text-ink-muted">Talla</dt>
                <dd className="font-semibold">{child.birthLengthCm != null ? `${num(child.birthLengthCm, 1)} cm` : "—"}</dd>
                <dt className="text-ink-muted">P. cefálico</dt>
                <dd className="font-semibold">{child.birthHeadCm != null ? `${num(child.birthHeadCm, 1)} cm` : "—"}</dd>
                <dt className="text-ink-muted">Sangre</dt>
                <dd className="font-semibold">{BLOOD_LABEL(child.bloodType)}</dd>
                <dt className="text-ink-muted">Alergias</dt>
                <dd>
                  {child.allergies.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {child.allergies.map((a) => <span key={a} className="pill bg-terracotta-100 text-terracotta-700">{a}</span>)}
                    </span>
                  ) : (
                    <span className="font-semibold">Ninguna registrada</span>
                  )}
                </dd>
              </dl>
              {child.notes && <p className="rounded-2xl bg-linen-100 px-4 py-3 text-sm text-ink-soft">{child.notes}</p>}
            </section>
          </div>

          <Modal open={adding} onClose={() => setAdding(false)} title={`Nueva medición de ${child.name}`}>
            <MeasurementForm child={child} onDone={() => setAdding(false)} />
          </Modal>
        </>
      )}
    </ChildPage>
  );
}
