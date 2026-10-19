"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MILESTONES, VACCINES } from "@/lib/catalog";
import { ageInMonths, daysBetween, formatAge, formatDate, formatMonths, parseISO, relativeDays } from "@/lib/date";
import { num, signed } from "@/lib/format";
import { downloadVaccineReminder } from "@/lib/reminders";
import { lastAchieved, overallRatio, overallState, STATE_LABEL, summarize } from "@/lib/milestones";
import { palette } from "@/lib/palette";
import { journeyProgress, nextStage, stageFor, stageProgress } from "@/lib/stage";
import { useStore } from "@/lib/store";
import type { Child } from "@/lib/types";
import { cardProgress, dueDate, nextVaccine, STATUS_LABEL, vaccineStatus } from "@/lib/vaccines";
import { ChildPage } from "./Page";
import { GrowthChart } from "./GrowthChart";
import { GrowthRings } from "./GrowthRings";
import { BookIcon, CalendarIcon, ChartIcon, PlusIcon, ShieldIcon, SproutIcon } from "./Icons";
import { MeasurementForm } from "./MeasurementForm";
import { Modal } from "./Modal";
import { DEV_PILL, SummaryTile, VACCINE_PILL } from "./ui";

const KIND_LABEL = { sonrisa: "Sonrisa", volteo: "Volteo", palabra: "Palabra", pasos: "Pasos", diente: "Diente", escuela: "Escuela", otro: "Recuerdo" } as const;

function longDate(iso: string) {
  const { y, m, d } = parseISO(iso);
  const text = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(new Date(y, m - 1, d));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function Dashboard() {
  return (
    <ChildPage title="Resumen de hoy">
      {(child) => <DashboardBody child={child} />}
    </ChildPage>
  );
}

function DashboardBody({ child }: { child: Child }) {
  const { state, today } = useStore();
  const [measuring, setMeasuring] = useState(false);

  const d = useMemo(() => {
    const ageMonths = ageInMonths(child.birthDate, today);
    const stage = stageFor(ageMonths);
    const vRecords = state.vaccineRecords.filter((r) => r.childId === child.id);
    const mRecords = state.milestoneRecords.filter((r) => r.childId === child.id);
    const summaries = summarize(MILESTONES, mRecords, ageMonths);
    const card = cardProgress(VACCINES, vRecords, child.birthDate, today);
    const measures = state.measurements
      .filter((m) => m.childId === child.id)
      .sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1));
    const journal = state.journal.filter((j) => j.childId === child.id).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
    return {
      ageMonths,
      stage,
      next: nextStage(stage),
      card,
      devState: overallState(summaries),
      devRatio: overallRatio(summaries),
      nextVac: nextVaccine(VACCINES, vRecords),
      lastMilestone: lastAchieved(MILESTONES, mRecords),
      latest: measures[0] ?? null,
      previous: measures[1] ?? null,
      lastEntry: journal[0] ?? null,
    };
  }, [child, state, today]);

  const nextVacDue = d.nextVac ? dueDate(child.birthDate, d.nextVac) : null;
  const nextVacStatus = d.nextVac ? vaccineStatus(d.nextVac, undefined, child.birthDate, today) : null;

  const weightDelta = d.latest?.weightKg != null && d.previous?.weightKg != null ? d.latest.weightKg - d.previous.weightKg : null;

  return (
    <>
      <p className="-mt-3 text-ink-soft">{longDate(today)}</p>

      {/* Héroe: etapa + anillos de crecimiento */}
      <section className="card relative overflow-hidden bg-gradient-to-br from-white via-white to-moss-50" aria-labelledby="hero-title">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-straw/25 blur-2xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-sage-600">{d.stage.range}</p>
              <h2 id="hero-title" className="text-4xl font-semibold sm:text-5xl">
                {child.name}
              </h2>
              <p className="mt-1 font-display text-2xl text-ink">{formatAge(child.birthDate, today)}</p>
            </div>
            <p className="max-w-md text-ink-soft">
              Etapa <strong className="text-moss">{d.stage.label}</strong>. {d.stage.blurb}
              {d.next && (
                <>
                  {" "}
                  Faltan <strong>{formatMonths(d.stage.to - d.ageMonths)}</strong> para ser <strong>{d.next.label}</strong>.
                </>
              )}
            </p>
            <div className="h-2.5 max-w-md overflow-hidden rounded-full bg-linen-200" aria-hidden>
              <div className="h-full rounded-full bg-gradient-to-r from-sage to-moss transition-all duration-1000" style={{ width: `${Math.round(stageProgress(d.ageMonths, d.stage) * 100)}%` }} />
            </div>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button type="button" className="btn-primary" onClick={() => setMeasuring(true)}>
                <PlusIcon width={18} height={18} /> Registrar medición
              </button>
              <Link href="/diario" className="btn-soft">
                <PlusIcon width={18} height={18} /> Nuevo recuerdo
              </Link>
            </div>
          </div>

          <GrowthRings
            stage={d.stage.id}
            stageLabel={d.stage.label}
            rings={[
              { key: "journey", label: "Camino a los 18 años", value: journeyProgress(d.ageMonths), color: palette.moss, detail: `${num(d.ageMonths / 12, 1)} de 18 años` },
              { key: "vaccines", label: "Cartilla al día", value: d.card.ratio, color: palette.sage, detail: `${d.card.applied} de ${d.card.expected} dosis` },
              { key: "milestones", label: "Hitos esperados", value: d.devRatio, color: palette.straw500, detail: STATE_LABEL[d.devState] },
            ]}
          />
        </div>
      </section>

      {/* Resumen */}
      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile title="Próxima vacuna" href="/vacunas" icon={<ShieldIcon width={18} height={18} />} cta="Ver cartilla">
          {d.nextVac && nextVacDue && nextVacStatus ? (
            <>
              <p className="font-display text-xl font-semibold leading-snug text-ink">{d.nextVac.name}</p>
              <p className="text-sm text-ink-soft">{d.nextVac.dose}</p>
              <p className="flex flex-wrap items-center gap-2 pt-1 text-sm">
                <span className={`pill ${VACCINE_PILL[nextVacStatus]}`}>{STATUS_LABEL[nextVacStatus]}</span>
                <span className="text-ink-muted">
                  {formatDate(nextVacDue)} · {relativeDays(nextVacDue, today)}
                </span>
              </p>
              <button
                type="button"
                onClick={() => d.nextVac && downloadVaccineReminder(child, d.nextVac)}
                className="relative z-10 mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-linen-100 px-3 text-xs font-bold text-moss hover:bg-moss-50"
              >
                <CalendarIcon width={16} height={16} /> Añadir al calendario
              </button>
            </>
          ) : (
            <p className="text-ink-soft">¡Esquema completo! No hay dosis pendientes en la cartilla.</p>
          )}
        </SummaryTile>

        <SummaryTile title="Último hito" href="/hitos" icon={<SproutIcon width={18} height={18} />} cta="Ver hitos">
          {d.lastMilestone ? (
            <>
              <p className="font-display text-lg font-semibold leading-snug text-ink">{d.lastMilestone.def.text}</p>
              <p className="text-sm text-ink-muted">{formatDate(d.lastMilestone.achievedAt)}</p>
            </>
          ) : (
            <p className="text-ink-soft">Marca el primer hito que {child.name} alcance.</p>
          )}
          <p className="pt-1">
            <span className={`pill ${DEV_PILL[d.devState]}`}>{STATE_LABEL[d.devState]}</span>
          </p>
        </SummaryTile>

        <SummaryTile title="Última medición" href="/crecimiento" icon={<ChartIcon width={18} height={18} />} cta="Ver curva">
          {d.latest ? (
            <>
              <p className="font-display text-xl font-semibold text-ink tabular-nums">
                {d.latest.weightKg != null && <>{num(d.latest.weightKg, 2)} kg</>}
                {d.latest.weightKg != null && d.latest.heightCm != null && <span className="text-ink-muted"> · </span>}
                {d.latest.heightCm != null && <>{num(d.latest.heightCm, 1)} cm</>}
              </p>
              <p className="text-sm text-ink-muted">
                {formatDate(d.latest.measuredAt)}
                {weightDelta != null && <> · {signed(weightDelta, 2)} kg</>}
              </p>
              {daysBetween(d.latest.measuredAt, today) > 120 && d.ageMonths < 60 && (
                <p className="text-xs font-semibold text-sand-700">Hace tiempo de la última medición.</p>
              )}
            </>
          ) : (
            <p className="text-ink-soft">Aún no hay mediciones.</p>
          )}
        </SummaryTile>

        <SummaryTile title="Último recuerdo" href="/diario" icon={<BookIcon width={18} height={18} />} cta="Abrir diario">
          {d.lastEntry ? (
            <>
              <p className="font-display text-lg font-semibold leading-snug text-ink">{d.lastEntry.title}</p>
              <p className="text-sm text-ink-muted">
                {KIND_LABEL[d.lastEntry.kind]} · {formatDate(d.lastEntry.occurredAt)}
              </p>
            </>
          ) : (
            <p className="text-ink-soft">Guarda la primera sonrisa, palabra o paso.</p>
          )}
        </SummaryTile>
      </section>

      {/* Curva compacta */}
      <section className="card" aria-labelledby="curve-title">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="curve-title" className="text-xl font-semibold">Curva de crecimiento</h2>
          <Link href="/crecimiento" className="text-sm font-bold text-moss hover:underline">Ver detalle →</Link>
        </div>
        <GrowthChart child={child} measurements={state.measurements} compact />
      </section>

      <Modal open={measuring} onClose={() => setMeasuring(false)} title={`Nueva medición de ${child.name}`}>
        <MeasurementForm child={child} onDone={() => setMeasuring(false)} />
      </Modal>
    </>
  );
}
