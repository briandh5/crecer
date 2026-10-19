"use client";

import { useMemo, useState } from "react";
import { VACCINES } from "@/lib/catalog";
import { addDays, formatDate, relativeDays } from "@/lib/date";
import { downloadVaccineReminder } from "@/lib/reminders";
import { palette } from "@/lib/palette";
import { useStore } from "@/lib/store";
import type { Child, VaccineDef, VaccineRecord } from "@/lib/types";
import {
  cardProgress,
  dueDate,
  nextDoseInSeries,
  nextVaccine,
  STATUS_LABEL,
  vaccineStatus,
  VACCINE_GROUPS,
  type VaccineStatus,
} from "@/lib/vaccines";
import { CalendarIcon, CheckIcon, ChevronIcon } from "./Icons";
import { VACCINE_PILL } from "./ui";

type Filter = "all" | "pending" | "applied";

export function VaccinationCard({ child }: { child: Child }) {
  const { state, today, actions } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const records = useMemo(() => state.vaccineRecords.filter((r) => r.childId === child.id), [state.vaccineRecords, child.id]);
  const byVaccine = useMemo(() => new Map(records.map((r) => [r.vaccineId, r])), [records]);
  const progress = cardProgress(VACCINES, records, child.birthDate, today);
  const next = nextVaccine(VACCINES, records);

  // Grupos abiertos: el de la próxima vacuna y los que tengan algo pendiente "ahora".
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(next ? [next.group] : []));
  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const statusOf = (v: VaccineDef): VaccineStatus => vaccineStatus(v, byVaccine.get(v.id), child.birthDate, today);
  const overdueCount = VACCINES.filter((v) => statusOf(v) === "overdue").length;

  function markApplied(v: VaccineDef) {
    // Captura rápida en consulta: queda con la fecha de hoy y se abre el detalle para anotar el lote.
    actions.saveVaccine({ childId: child.id, vaccineId: v.id, appliedAt: today, lot: "", place: "" });
    setOpenId(v.id);
  }

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <section className="card flex flex-col gap-5 sm:flex-row sm:items-center" aria-label="Resumen de la cartilla">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${Math.round(progress.ratio * 100)} % de la cartilla al día`}>
            <circle cx="50" cy="50" r="42" fill="none" stroke={palette.linen200} strokeWidth="11" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={palette.sage}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 42}
              strokeDashoffset={2 * Math.PI * 42 * (1 - progress.ratio)}
              className="transition-[stroke-dashoffset] duration-1000"
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center font-display text-2xl font-semibold text-moss">
            {Math.round(progress.ratio * 100)}%
          </span>
        </div>
        <div className="flex-1 space-y-1">
          <p className="font-display text-xl font-semibold text-ink">
            {progress.applied} de {progress.expected} dosis que ya corresponden
          </p>
          {overdueCount > 0 ? (
            <p className="text-sm text-terracotta-700">
              {overdueCount === 1 ? "Hay 1 dosis pendiente" : `Hay ${overdueCount} dosis pendientes`}. Pregunta en tu próxima cita cómo ponerlas al día; no hace falta reiniciar el esquema.
            </p>
          ) : (
            <p className="text-sm text-ink-soft">No hay dosis atrasadas. ¡Buen trabajo!</p>
          )}
          {next && (
            <p className="text-sm text-ink-muted">
              Siguiente: <strong className="text-ink">{next.name} · {next.dose}</strong> — {formatDate(dueDate(child.birthDate, next))} (
              {relativeDays(dueDate(child.birthDate, next), today)})
            </p>
          )}
        </div>
      </section>

      {/* Filtros */}
      <div role="group" aria-label="Filtrar vacunas" className="inline-flex rounded-2xl bg-linen-100 p-1">
        {(
          [
            ["all", "Todas"],
            ["pending", "Pendientes"],
            ["applied", "Aplicadas"],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={`min-h-[40px] rounded-xl px-4 text-sm font-bold transition ${filter === id ? "bg-white text-moss shadow-soft" : "text-ink-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grupos por edad */}
      <div className="space-y-4">
        {VACCINE_GROUPS.map((group) => {
          const all = VACCINES.filter((v) => v.group === group.id);
          const shown = all.filter((v) => {
            const applied = byVaccine.has(v.id);
            return filter === "all" || (filter === "applied" ? applied : !applied);
          });
          if (shown.length === 0) return null;
          const required = all.filter((v) => !v.optional);
          const done = required.filter((v) => byVaccine.has(v.id)).length;
          const open = openGroups.has(group.id) || filter !== "all";
          const panelId = `vg-${group.id}`;

          return (
            <section key={group.id} className="card !p-0 overflow-hidden">
              <h2 className="!text-base">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggleGroup(group.id)}
                  className="flex min-h-[64px] w-full items-center gap-4 px-5 py-3 text-left sm:px-6"
                >
                  <span className="flex-1">
                    <span className="block font-display text-xl font-semibold text-moss">{group.label}</span>
                    <span className="block text-sm font-normal text-ink-muted">{group.hint}</span>
                  </span>
                  <span className={`pill ${done === required.length ? "bg-moss-100 text-moss" : "bg-linen-100 text-ink-soft"}`}>
                    {done}/{required.length}
                  </span>
                  <ChevronIcon className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
              </h2>
              {open && (
                <ul id={panelId} className="divide-y divide-linen-200 border-t border-linen-200">
                  {shown.map((v) => (
                    <VaccineRow
                      key={v.id}
                      v={v}
                      child={child}
                      record={byVaccine.get(v.id)}
                      status={statusOf(v)}
                      today={today}
                      expanded={openId === v.id}
                      onToggleExpand={() => setOpenId(openId === v.id ? null : v.id)}
                      onApply={() => markApplied(v)}
                      followUpApplied={(f) => byVaccine.has(f)}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <p className="text-xs text-ink-muted">
        Esquema de referencia basado en el calendario nacional de México; varía por país y por indicación médica. Confirma siempre con tu pediatra o centro de
        salud. Las vacunas marcadas «según esquema local» no cuentan para el avance.
      </p>
    </div>
  );
}

function VaccineRow({
  v,
  child,
  record,
  status,
  today,
  expanded,
  onToggleExpand,
  onApply,
  followUpApplied,
}: {
  v: VaccineDef;
  child: Child;
  record: VaccineRecord | undefined;
  status: VaccineStatus;
  today: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onApply: () => void;
  followUpApplied: (vaccineId: string) => boolean;
}) {
  const { actions } = useStore();
  const due = dueDate(child.birthDate, v);
  const followUp = nextDoseInSeries(VACCINES, v);
  const applied = !!record;

  return (
    <li className={`px-5 py-3.5 sm:px-6 ${applied ? "bg-moss-50/40" : ""}`}>
      <div className="flex items-start gap-3.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={applied}
          aria-label={`${v.name}, ${v.dose}: ${applied ? "aplicada" : "marcar como aplicada"}`}
          onClick={() => (applied ? onToggleExpand() : onApply())}
          className={`mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 transition active:scale-95
            ${applied ? "border-moss bg-moss text-white" : "border-sand bg-white text-transparent hover:border-sage hover:text-sage-300"}`}
        >
          <CheckIcon />
        </button>

        <div className="min-w-0 flex-1">
          <button type="button" onClick={onToggleExpand} aria-expanded={expanded} className="w-full text-left">
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="font-bold text-ink">{v.name}</span>
              <span className="text-sm text-ink-soft">{v.dose}</span>
              <span className={`pill ${VACCINE_PILL[status]}`}>{STATUS_LABEL[status]}</span>
            </span>
            <span className="mt-0.5 block text-sm text-ink-muted">
              {applied ? (
                <>
                  Aplicada el {formatDate(record.appliedAt)}
                  {record.lot && <> · Lote {record.lot}</>}
                </>
              ) : (
                <>
                  Recomendada: {formatDate(due)} · {relativeDays(due, today)}
                </>
              )}
            </span>
          </button>

          {expanded && (
            <div className="mt-3 animate-grow space-y-3 rounded-2xl bg-linen-100/70 p-4">
              <p className="text-sm text-ink-soft">
                <strong className="text-ink">Protege contra:</strong> {v.protectsAgainst}
              </p>

              {applied ? (
                <ApplicationForm key={`${v.id}-${record.appliedAt}-${record.lot}-${record.place}`} record={record} child={child} today={today} onClear={() => actions.clearVaccine(child.id, v.id)} />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary" onClick={onApply}>
                    <CheckIcon width={18} height={18} /> Marcar como aplicada
                  </button>
                  <button type="button" className="btn-soft" onClick={() => downloadVaccineReminder(child, v)}>
                    <CalendarIcon width={18} height={18} /> Recordatorio en calendario
                  </button>
                </div>
              )}

              {applied && followUp && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-white px-3.5 py-2.5 text-sm text-ink-soft">
                  <span>
                    <strong className="text-ink">Próxima dosis de la serie:</strong> {followUp.dose} — {formatDate(dueDate(child.birthDate, followUp))}
                  </span>
                  {!followUpApplied(followUp.id) && (
                    <button type="button" onClick={() => downloadVaccineReminder(child, followUp)} className="inline-flex items-center gap-1.5 font-bold text-moss hover:underline">
                      <CalendarIcon width={16} height={16} /> Añadir recordatorio
                    </button>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function ApplicationForm({ record, child, today, onClear }: { record: VaccineRecord; child: Child; today: string; onClear: () => void }) {
  const { actions } = useStore();
  const [date, setDate] = useState(record.appliedAt);
  const [lot, setLot] = useState(record.lot);
  const [place, setPlace] = useState(record.place);
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = date !== record.appliedAt || lot !== record.lot || place !== record.place;
  const dateOk = date >= child.birthDate && date <= today;
  const id = `${record.vaccineId}`;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!dateOk) return;
        actions.saveVaccine({ ...record, appliedAt: date, lot: lot.trim(), place: place.trim() });
        setSaved(true);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`d-${id}`} className="label">Fecha de aplicación</label>
          <input id={`d-${id}`} type="date" className="field" value={date} min={child.birthDate} max={today} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor={`l-${id}`} className="label">Lote</label>
          <input id={`l-${id}`} className="field" value={lot} onChange={(e) => setLot(e.target.value)} placeholder="Ej. A3117" maxLength={40} autoComplete="off" />
        </div>
        <div>
          <label htmlFor={`p-${id}`} className="label">Lugar</label>
          <input id={`p-${id}`} className="field" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Centro de salud" maxLength={60} autoComplete="off" />
        </div>
      </div>
      {!dateOk && <p role="alert" className="text-sm font-semibold text-terracotta-700">La fecha debe estar entre el nacimiento y hoy.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-primary" disabled={!dirty || !dateOk}>Guardar datos</button>
        {confirming ? (
          <>
            <button type="button" className="btn-danger" onClick={onClear}>Sí, quitar marca</button>
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>Cancelar</button>
          </>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => setConfirming(true)}>Quitar marca</button>
        )}
        {saved && !dirty && <span role="status" className="text-sm font-bold text-moss">Guardado</span>}
      </div>
    </form>
  );
}
