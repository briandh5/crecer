import type { StageId } from "@/lib/stage";
import { palette as c } from "@/lib/palette";

interface Props {
  stage: StageId;
  size?: number;
  className?: string;
  /** Si se omite, el icono es decorativo. */
  label?: string;
}

/** Brote → Arbolito → Árbol en crecimiento. */
export function PlantIcon({ stage, size = 64, className, label }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* Suelo */}
      <ellipse cx="32" cy="57" rx="17" ry="4" fill={c.sand} opacity=".55" />
      {stage === "brote" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 56 C32 46 32 40 32 33" stroke={c.moss} strokeWidth="3" fill="none" />
          <path d="M32 38 C22 38 14 31 14 21 C25 20 32 27 32 38Z" fill={c.sage} />
          <path d="M32 33 C32 22 40 14 51 14 C52 25 44 33 32 33Z" fill={c.moss400} />
          <path d="M32 38 C27 34 22 30 18 25" stroke={c.moss} strokeWidth="1.4" fill="none" opacity=".45" />
        </g>
      )}
      {stage === "arbolito" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 56 C32 46 31 36 32 22" stroke={c.sand700} strokeWidth="3.6" fill="none" />
          <path d="M32 44 C24 43 17 38 15 30 C24 29 31 34 32 44Z" fill={c.sage} />
          <path d="M32 38 C40 37 47 32 49 24 C40 23 33 28 32 38Z" fill={c.moss400} />
          <path d="M32 26 C24 25 19 19 19 12 C27 12 32 17 32 26Z" fill={c.moss400} />
          <path d="M32 24 C32 15 38 8 46 8 C47 17 41 24 32 24Z" fill={c.sage} />
          <circle cx="32" cy="20" r="2.2" fill={c.straw} />
        </g>
      )}
      {stage === "arbol" && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M28 57 C30 48 30 42 29 34 L35 34 C34 42 34 48 36 57Z" fill={c.sand700} />
          <path d="M32 44 C27 40 24 38 21 33" stroke={c.sand700} strokeWidth="2.6" fill="none" />
          <path d="M33 40 C38 37 41 35 44 31" stroke={c.sand700} strokeWidth="2.6" fill="none" />
          <circle cx="32" cy="22" r="14" fill={c.moss} />
          <circle cx="19" cy="29" r="9.5" fill={c.moss400} />
          <circle cx="45" cy="28" r="10" fill={c.sage} />
          <circle cx="30" cy="14" r="8" fill={c.sage} opacity=".9" />
          <circle cx="40" cy="19" r="2" fill={c.straw} />
          <circle cx="24" cy="24" r="1.8" fill={c.straw} />
          <circle cx="35" cy="30" r="1.8" fill={c.straw} />
        </g>
      )}
    </svg>
  );
}
