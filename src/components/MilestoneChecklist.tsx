"use client";

import { useMemo, useState } from "react";
import { MILESTONES } from "@/lib/catalog";
import { ageInMonths } from "@/lib/date";
import {
  checkpointLabel,
  checkpoints,
  currentCheckpoint,
  DOMAINS,
  GRACE_MONTHS,
  overallState,
  STATE_LABEL,
  summarize,
} from "@/lib/milestones";
import { useStore } from "@/lib/store";
import type { Child, MilestoneDomain } from "@/lib/types";
import { CheckIcon } from "./Icons";
import { DEV_BAR, DEV_PILL } from "./ui";

const POINTS = checkpoints(MILESTONES);

const STATE_HELP = {
  "pending-data": "Todavía es pronto para valorar este aspecto: los primeros hitos se evalúan unos meses después de la edad en que se esperan.",
  expected: "Alcanza la gran mayoría de lo que se espera a su edad.",
  watch: "Faltan algunos hitos que ya se esperaban. Obsérvalos con calma y coméntalos en la próxima consulta.",
  consult: "Faltan varios hitos esperados. Conviene comentarlo con tu pediatra; hablarlo pronto ayuda.",
} as const;

export function MilestoneChecklist({ child }: { child: Child }) {
  const { state, today, actions } = useStore();
  const ageMonths = ageInMonths(child.birthDate, today);
  const [selected, setSelected] = useState(() => currentCheckpoint(POINTS, ageMonths));
  const [domainFilter, setDomainFilter] = useState<MilestoneDomain | "all">("all");

  const records = useMemo(() => state.milestoneRecords.filter((r) => r.childId === child.id), [state.milestoneRecords, child.id]);
  const done = useMemo(() => new Map(records.map((r) => [r.milestoneId, r.achievedAt])), [records]);
  const summaries = useMemo(() => summarize(MILESTONES, records, ageMonths), [records, ageMonths]);
  const overall = overallState(summaries);
  const current = currentCheckpoint(POINTS, ageMonths);

  const items = MILESTONES.filter((m) => m.month === selected);
  const groups = DOMAINS.filter((d) => domainFilter === "all" || d.id === domainFilter)
    .map((d) => ({ ...d, items: items.filter((m) => m.domain === d.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Indicadores por área */}
      <section className="card space-y-5" aria-labelledby="dev-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="dev-title" className="text-xl font-semibold">¿Cómo va el desarrollo?</h2>
          <span className={`pill !px-3.5 !py-1.5 !text-sm ${DEV_PILL[overall]}`}>{STATE_LABEL[overall]}</span>
        </div>
        <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {summaries.map((s) => {
            const label = DOMAINS.find((d) => d.id === s.domain)!.label;
            const ratio = s.evaluable === 0 ? 0 : s.achieved / s.evaluable;
            return (
              <li key={s.domain}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-ink">{label}</span>
                  <span className="text-xs text-ink-muted">
                    {s.evaluable === 0 ? "Aún es pronto" : `${s.achieved} de ${s.evaluable} esperados`}
                  </span>
                </div>
                <div
                  className="h-3 overflow-hidden rounded-full bg-linen-200"
                  role="progressbar"
                  aria-label={`${label}: ${STATE_LABEL[s.state]}`}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(s.evaluable, 1)}
                  aria-valuenow={s.achieved}
                >
                  <div className={`h-full rounded-full transition-all duration-700 ${DEV_BAR[s.state]}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  <span className="font-bold">{STATE_LABEL[s.state]}.</span> {STATE_HELP[s.state]}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="rounded-2xl bg-linen-100 px-4 py-3 text-xs text-ink-soft">
          Esta guía es orientativa y <strong>no es un diagnóstico</strong>. Cada niño avanza a su ritmo; se cuentan los hitos que ya se esperaban hace al menos {GRACE_MONTHS} meses.
          Si te preocupa algo, aunque aquí salga en verde, consúltalo con tu pediatra. Basado en los hitos de la guía «Aprende los signos. Reacciona pronto» (CDC/AAP, 2022) hasta los 5 años;
          los de edades mayores son orientativos.
        </p>
      </section>

      {/* Etapas */}
      <div>
        <h2 className="mb-2 text-lg font-semibold">Hitos por edad</h2>
        <div role="tablist" aria-label="Edad de control" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {POINTS.map((p) => {
            const list = MILESTONES.filter((m) => m.month === p);
            const n = list.filter((m) => done.has(m.id)).length;
            const active = p === selected;
            return (
              <button
                key={p}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setSelected(p)}
                className={`flex min-h-[56px] shrink-0 flex-col items-start justify-center rounded-2xl border px-4 text-left transition ${
                  active ? "border-moss bg-moss text-white shadow-soft" : "border-linen-200 bg-white/80 text-ink hover:border-sage"
                }`}
              >
                <span className="text-sm font-bold">{checkpointLabel(p)}</span>
                <span className={`text-xs ${active ? "text-moss-100" : "text-ink-muted"}`}>
                  {p === current ? "Ahora · " : p > ageMonths ? "Próximo · " : ""}
                  {n}/{list.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div role="group" aria-label="Filtrar por área" className="flex flex-wrap gap-2">
        {[{ id: "all" as const, short: "Todas" }, ...DOMAINS].map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={domainFilter === d.id}
            onClick={() => setDomainFilter(d.id)}
            className={`min-h-[40px] rounded-full px-4 text-sm font-bold transition ${
              domainFilter === d.id ? "bg-sage text-white" : "bg-white/80 text-ink-soft hover:bg-white"
            }`}
          >
            {d.short}
          </button>
        ))}
      </div>

      {/* Lista */}
      <section aria-label={`Hitos de ${checkpointLabel(selected)}`} className="space-y-4">
        {groups.length === 0 && <p className="text-ink-muted">No hay hitos de esta área en esta edad.</p>}
        {groups.map((g) => (
          <div key={g.id} className="card !p-0 overflow-hidden">
            <h3 className="border-b border-linen-200 bg-linen-100/60 px-5 py-3 text-base font-semibold sm:px-6">{g.label}</h3>
            <ul className="divide-y divide-linen-200">
              {g.items.map((m) => {
                const achievedAt = done.get(m.id);
                const overdue = !achievedAt && m.month + GRACE_MONTHS <= ageMonths;
                return (
                  <li key={m.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 sm:px-6 ${achievedAt ? "bg-moss-50/40" : ""}`}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={!!achievedAt}
                      onClick={() => actions.setMilestone(child.id, m.id, achievedAt ? null : today)}
                      className="group flex min-h-[48px] flex-1 items-center gap-3.5 text-left"
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 transition group-active:scale-95 ${
                          achievedAt ? "border-moss bg-moss text-white" : "border-sand bg-white text-transparent group-hover:border-sage group-hover:text-sage-300"
                        }`}
                      >
                        <CheckIcon width={20} height={20} />
                      </span>
                      <span>
                        <span className="block text-ink">{m.text}</span>
                        {overdue && <span className="block text-xs font-bold text-terracotta-600">Esperado a esta edad · aún sin marcar</span>}
                      </span>
                    </button>
                    {achievedAt && (
                      <label className="flex items-center gap-2 text-xs text-ink-muted">
                        <span className="sr-only sm:not-sr-only">Logrado el</span>
                        <input
                          type="date"
                          className="field !min-h-[40px] !w-auto !py-1 !text-sm"
                          value={achievedAt}
                          min={child.birthDate}
                          max={today}
                          aria-label={`Fecha en que logró: ${m.text}`}
                          onChange={(e) => e.target.value && actions.setMilestone(child.id, m.id, e.target.value)}
                        />
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {achievedHint(selected, ageMonths)}
      </section>
      <p className="sr-only" aria-live="polite">{records.length} hitos marcados</p>
    </div>
  );
}

function achievedHint(selected: number, ageMonths: number) {
  if (selected <= ageMonths) return null;
  return (
    <p className="text-sm text-ink-muted">
      Estos hitos se esperan a partir de los {checkpointLabel(selected)}. Si ya los logró, ¡márcalos! Si todavía no, no pasa nada.
    </p>
  );
}
