"use client";

import { useId, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ageInMonthsExact, formatDate, formatMonths } from "@/lib/date";
import { num, signed } from "@/lib/format";
import { referenceMedian, referenceSeries, REFERENCE_MAX_MONTH, type Metric } from "@/lib/growth-reference";
import { palette as c } from "@/lib/palette";
import type { Child, Measurement } from "@/lib/types";

interface Props {
  child: Child;
  measurements: Measurement[];
  /** Versión reducida para el dashboard. */
  compact?: boolean;
  defaultMetric?: Metric;
}

interface Row {
  month: number;
  value: number;
  ref: number | null;
  date: string;
  note: string;
  isBirth: boolean;
}

const METRICS: Record<Metric, { label: string; unit: string; digits: number; pick: (m: Measurement) => number | null }> = {
  weight: { label: "Peso", unit: "kg", digits: 2, pick: (m) => m.weightKg },
  height: { label: "Talla", unit: "cm", digits: 1, pick: (m) => m.heightCm },
};

/** Separación entre marcas del eje X (meses) según el rango que haya que cubrir. */
function xStep(maxMonth: number) {
  if (maxMonth <= 18) return 3;
  if (maxMonth <= 36) return 6;
  if (maxMonth <= 72) return 12;
  if (maxMonth <= 144) return 24;
  return 36;
}

const tickLabel = (m: number) => (m < 24 ? `${m} m` : `${num(m / 12, 1)} a`);

/** "2 años y 4 meses" para un número de meses con decimales. */
const ageLabel = (month: number) => (month < 0.5 ? "Al nacer" : formatMonths(Math.round(month)));

export function GrowthChart({ child, measurements, compact = false, defaultMetric = "weight" }: Props) {
  const [metric, setMetric] = useState<Metric>(defaultMetric);
  const [showRef, setShowRef] = useState(true);
  const gradId = useId().replace(/:/g, "");
  const cfg = METRICS[metric];

  const rows = useMemo<Row[]>(
    () =>
      measurements
        .filter((m) => m.childId === child.id && cfg.pick(m) != null)
        .map((m) => {
          const month = Math.round(ageInMonthsExact(child.birthDate, m.measuredAt) * 100) / 100;
          const ref = referenceMedian(metric, child.sex, month);
          return {
            month,
            value: cfg.pick(m)!,
            ref: ref == null ? null : Math.round(ref * 10) / 10,
            date: m.measuredAt,
            note: m.note,
            isBirth: m.source === "birth",
          };
        })
        .sort((a, b) => a.month - b.month),
    [measurements, child.id, child.birthDate, child.sex, metric, cfg],
  );

  const lastMonth = rows.length ? rows[rows.length - 1].month : 0;
  const step = xStep(lastMonth);
  const xMax = Math.max(step, Math.ceil((lastMonth + 0.5) / step) * step);
  const ticks = useMemo(() => Array.from({ length: Math.floor(xMax / step) + 1 }, (_, i) => i * step), [xMax, step]);

  const refData = useMemo(() => (showRef ? referenceSeries(metric, child.sex, xMax) : []), [showRef, metric, child.sex, xMax]);
  const refAvailable = rows.some((r) => r.month <= REFERENCE_MAX_MONTH);

  const [yMin, yMax] = useMemo(() => {
    const all = [...rows.map((r) => r.value), ...refData.map((r) => r.ref)];
    if (!all.length) return [0, 10];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = Math.max((hi - lo) * 0.12, metric === "weight" ? 0.5 : 2);
    const unit = metric === "weight" ? 1 : 5;
    return [Math.max(0, Math.floor((lo - pad) / unit) * unit), Math.ceil((hi + pad) / unit) * unit];
  }, [rows, refData, metric]);

  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const first = rows[0];

  const summary = last
    ? `Gráfica de ${cfg.label.toLowerCase()} de ${child.name}: ${rows.length} mediciones, de ${num(first.value, cfg.digits)} ${cfg.unit} ${
        first.isBirth ? "al nacer" : `a los ${ageLabel(first.month)}`
      } a ${num(last.value, cfg.digits)} ${cfg.unit} a los ${ageLabel(last.month)}.`
    : `Sin mediciones de ${cfg.label.toLowerCase()}.`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="Medida a graficar" className="inline-flex rounded-2xl bg-linen-100 p-1">
          {(Object.keys(METRICS) as Metric[]).map((key) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={metric === key}
              onClick={() => setMetric(key)}
              className={`min-h-[40px] rounded-xl px-4 text-sm font-bold transition ${
                metric === key ? "bg-white text-moss shadow-soft" : "text-ink-muted hover:text-ink"
              }`}
            >
              {METRICS[key].label}
            </button>
          ))}
        </div>

        {last && (
          <p className="text-right">
            <span className="font-display text-3xl font-semibold text-moss tabular-nums">{num(last.value, cfg.digits)}</span>
            <span className="ml-1 text-sm font-bold text-ink-muted">{cfg.unit}</span>
            {prev && (
              <span className="block text-xs text-ink-muted">
                {signed(last.value - prev.value, cfg.digits)} {cfg.unit} desde {formatDate(prev.date, false)}
              </span>
            )}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-sand-200 bg-linen-100/60 text-center text-ink-muted" style={{ height: compact ? 200 : 320 }}>
          <p className="max-w-xs px-4 text-sm">Aún no hay mediciones de {cfg.label.toLowerCase()}. Registra la primera para ver la curva.</p>
        </div>
      ) : (
        <div role="img" aria-label={summary} style={{ height: compact ? 220 : 340 }} className="-ml-2 select-none">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 12, right: 14, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id={`g-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.sage} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={c.sage} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={c.linen200} strokeDasharray="2 6" />
              <XAxis
                dataKey="month"
                type="number"
                domain={[0, xMax]}
                ticks={ticks}
                tickFormatter={tickLabel}
                tickLine={false}
                axisLine={{ stroke: c.sand, strokeWidth: 1.5 }}
                tick={{ fill: c.inkMuted, fontSize: 12, fontWeight: 600 }}
                tickMargin={8}
              />
              <YAxis
                domain={[yMin, yMax]}
                tickLine={false}
                axisLine={false}
                width={compact ? 34 : 42}
                tick={{ fill: c.inkMuted, fontSize: 12, fontWeight: 600 }}
                tickFormatter={(v: number) => num(v, 0)}
                unit={compact ? "" : ` ${cfg.unit}`}
              />
              <Tooltip
                cursor={{ stroke: c.sage, strokeWidth: 1.5, strokeDasharray: "4 4" }}
                content={(p) => <ChartTooltip active={p.active} payload={p.payload} unit={cfg.unit} digits={cfg.digits} label={cfg.label} />}
              />
              {showRef && refData.length > 0 && (
                <Line
                  data={refData}
                  dataKey="ref"
                  name="Mediana de referencia"
                  stroke={c.sand400}
                  strokeWidth={2}
                  strokeDasharray="6 6"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                  tooltipType="none"
                />
              )}
              <Area
                dataKey="value"
                type="monotone"
                stroke="none"
                fill={`url(#g-${gradId})`}
                activeDot={false}
                isAnimationActive={false}
                tooltipType="none"
              />
              <Line
                dataKey="value"
                name={cfg.label}
                type="monotone"
                stroke={c.moss}
                strokeWidth={3.5}
                strokeLinecap="round"
                dot={{ r: 5, fill: c.straw, stroke: c.moss, strokeWidth: 2.5 }}
                activeDot={{ r: 8, fill: c.terracotta, stroke: "#fff", strokeWidth: 3 }}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-moss bg-straw" aria-hidden /> {child.name}
        </span>
        {refAvailable && (
          <label className="inline-flex min-h-[32px] cursor-pointer items-center gap-2">
            <input type="checkbox" checked={showRef} onChange={(e) => setShowRef(e.target.checked)} className="h-4 w-4 accent-moss" />
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-5 border-t-2 border-dashed border-sand-400" aria-hidden /> Mediana de referencia (OMS, 0–5 años)
            </span>
          </label>
        )}
      </div>
      {!compact && (
        <p className="mt-2 text-xs text-ink-muted">
          La línea de referencia es orientativa y no reemplaza las curvas de percentiles de tu pediatra: cada niño crece a su ritmo.
        </p>
      )}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  unit,
  digits,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  unit: string;
  digits: number;
  label: string;
}) {
  if (!active || !payload?.length) return null;
  // Recharts también entrega puntos de la línea de referencia (sin fecha ni medición): solo se muestran las mediciones.
  const row = payload.map((p) => p.payload as Partial<Row> | undefined).find((r): r is Row => typeof r?.date === "string");
  if (!row) return null;
  const diff = row.ref == null ? null : row.value - row.ref;
  return (
    <div className="max-w-[16rem] rounded-2xl border border-linen-200 bg-white px-4 py-3 shadow-lift">
      <p className="text-xs font-bold uppercase tracking-wide text-sage-600">{ageLabel(row.month)}</p>
      <p className="mt-0.5 text-ink">
        <span className="font-display text-2xl font-semibold text-moss tabular-nums">{num(row.value, digits)}</span>{" "}
        <span className="text-sm font-bold text-ink-muted">{unit}</span>
      </p>
      <p className="text-xs text-ink-muted">
        {label} · {formatDate(row.date)}
      </p>
      {row.ref != null && diff != null && (
        <p className="mt-1.5 border-t border-linen-200 pt-1.5 text-xs text-ink-soft">
          Mediana de referencia: {num(row.ref, 1)} {unit}{" "}
          <span className="font-bold text-sand-700">({signed(diff, 1)})</span>
        </p>
      )}
      {row.note && <p className="mt-1.5 text-xs italic text-ink-soft">«{row.note}»</p>}
    </div>
  );
}
