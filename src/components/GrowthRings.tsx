"use client";

import { useEffect, useState } from "react";
import { palette as c } from "@/lib/palette";
import { PlantIcon } from "./PlantIcon";
import type { StageId } from "@/lib/stage";

export interface Ring {
  key: string;
  label: string;
  /** 0–1 */
  value: number;
  color: string;
  /** Texto corto que acompaña al porcentaje, p. ej. "11 de 12 dosis". */
  detail?: string;
}

interface Props {
  stage: StageId;
  stageLabel: string;
  rings: Ring[];
  size?: number;
  showLegend?: boolean;
}

const STROKE = 13;
const GAP = 5;

/**
 * "Anillos de crecimiento": cada anillo es una dimensión del avance, de afuera hacia adentro.
 * Se dibujan desde vacío al montar para que se vean "crecer".
 */
export function GrowthRings({ stage, stageLabel, rings, size = 220, showLegend = true }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const half = size / 2;
  const summary = rings.map((r) => `${r.label}: ${Math.round(r.value * 100)} %`).join(". ");

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Anillos de crecimiento. ${summary}`}>
          {rings.map((ring, i) => {
            const r = half - STROKE / 2 - 2 - i * (STROKE + GAP);
            const len = 2 * Math.PI * r;
            const shown = mounted ? Math.min(1, Math.max(0, ring.value)) : 0;
            return (
              <g key={ring.key} transform={`rotate(-90 ${half} ${half})`}>
                <circle cx={half} cy={half} r={r} fill="none" stroke={c.linen200} strokeWidth={STROKE} />
                <circle
                  cx={half}
                  cy={half}
                  r={r}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={len}
                  strokeDashoffset={len * (1 - shown)}
                  style={{ transition: `stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1) ${i * 0.12}s` }}
                />
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <PlantIcon stage={stage} size={size * 0.34} className="animate-sway origin-bottom" />
          <span className="mt-0.5 max-w-[7rem] text-center font-display text-sm font-semibold leading-tight text-moss">
            {stageLabel}
          </span>
        </div>
      </div>

      {showLegend && (
        <ul className="w-full space-y-2.5 sm:w-auto sm:min-w-[13rem]">
          {rings.map((ring) => (
            <li key={ring.key} className="flex items-center gap-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: ring.color }} aria-hidden />
              <span className="flex-1 text-sm text-ink-soft">
                {ring.label}
                {ring.detail && <span className="block text-xs text-ink-muted">{ring.detail}</span>}
              </span>
              <span className="font-display text-lg font-semibold tabular-nums text-ink">{Math.round(ring.value * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
