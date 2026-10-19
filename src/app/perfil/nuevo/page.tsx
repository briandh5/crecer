"use client";

import { ChildForm } from "@/components/ChildForm";
import { PageSkeleton } from "@/components/Page";
import { useStore } from "@/lib/store";

export default function NewProfilePage() {
  const { ready } = useStore();
  if (!ready) return <PageSkeleton />;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Nuevo perfil</h1>
        <p className="mt-1 text-ink-soft">Cuéntanos de quién vamos a cuidar el crecimiento.</p>
      </div>
      <ChildForm />
    </div>
  );
}
