"use client";

import { ChildForm } from "@/components/ChildForm";
import { EmptyProfiles, PageSkeleton } from "@/components/Page";
import { useStore } from "@/lib/store";

export default function EditProfilePage() {
  const { ready, child } = useStore();
  if (!ready) return <PageSkeleton />;
  if (!child) return <EmptyProfiles />;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold">Perfil de {child.name}</h1>
      <ChildForm key={child.id} child={child} />
    </div>
  );
}
