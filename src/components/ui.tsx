import Link from "next/link";
import type { ReactNode } from "react";
import type { DevState } from "@/lib/milestones";
import type { VaccineStatus } from "@/lib/vaccines";

export const VACCINE_PILL: Record<VaccineStatus, string> = {
  applied: "bg-moss-100 text-moss",
  overdue: "bg-terracotta-100 text-terracotta-700",
  due: "bg-straw-100 text-straw-700",
  upcoming: "bg-sage-100 text-sage-700",
  optional: "bg-linen-100 text-ink-muted",
};

export const DEV_PILL: Record<DevState, string> = {
  "pending-data": "bg-linen-100 text-ink-muted",
  expected: "bg-moss-100 text-moss",
  watch: "bg-straw-100 text-straw-700",
  consult: "bg-terracotta-100 text-terracotta-700",
};

export const DEV_BAR: Record<DevState, string> = {
  "pending-data": "bg-sand-200",
  expected: "bg-moss-400",
  watch: "bg-straw-400",
  consult: "bg-terracotta",
};

export function SummaryTile({
  title,
  href,
  icon,
  children,
  cta,
}: {
  title: string;
  href: string;
  icon: ReactNode;
  children: ReactNode;
  cta: string;
}) {
  return (
    <div className="group card relative flex flex-col gap-3 !p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sage-600">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-sage-100 text-moss">{icon}</span>
        {title}
      </span>
      <div className="flex-1 space-y-1">{children}</div>
      {/* El enlace se estira sobre toda la tarjeta; los botones internos quedan por encima (z-10). */}
      <Link href={href} className="text-sm font-bold text-moss after:absolute after:inset-0 after:rounded-3xl group-hover:underline">
        {cta} →
      </Link>
    </div>
  );
}
