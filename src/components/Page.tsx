"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { Child } from "@/lib/types";
import { ChildSwitcher } from "./ChildSwitcher";
import { PlantIcon } from "./PlantIcon";

/**
 * Envoltorio común de las secciones: espera a que carguen los datos, muestra el selector de hijos
 * y, si todavía no hay ninguno, invita a crear el primer perfil.
 */
export function ChildPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: (child: Child) => ReactNode;
}) {
  const { ready, child } = useStore();

  if (!ready) return <PageSkeleton />;

  if (!child) return <EmptyProfiles />;

  return (
    <div className="space-y-6">
      <ChildSwitcher />
      <div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        {intro && <p className="mt-1 max-w-2xl text-ink-soft">{intro}</p>}
      </div>
      <div key={child.id} className="animate-grow space-y-6">
        {children(child)}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="h-14 w-64 animate-pulse rounded-2xl bg-linen-200" />
      <div className="h-8 w-48 animate-pulse rounded-xl bg-linen-200" />
      <div className="h-64 animate-pulse rounded-3xl bg-linen-200" />
    </div>
  );
}

export function EmptyProfiles() {
  const { base } = useStore();
  return (
    <div className="card mx-auto mt-10 max-w-md text-center">
      <PlantIcon stage="brote" size={96} className="mx-auto" />
      <h1 className="mt-2 text-2xl font-semibold">Planta la primera semilla</h1>
      <p className="mt-2 text-ink-soft">
        Crea el perfil de tu hijo o hija para empezar a registrar su crecimiento, vacunas y primeros logros.
      </p>
      <Link href={`${base}/perfil/nuevo`} className="btn-primary mt-6">
        Crear perfil
      </Link>
    </div>
  );
}
