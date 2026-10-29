"use client";

import { AccountSettings } from "@/components/AccountSettings";
import { FamilySettings } from "@/components/FamilySettings";
import { PageSkeleton } from "@/components/Page";
import { useStore } from "@/lib/store";

export default function AccountPage() {
  const { ready, username } = useStore();
  if (!ready) return <PageSkeleton />;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Mi cuenta</h1>
        <p className="mt-1 text-ink-soft">
          Usuario: <strong className="text-ink">@{username}</strong>
        </p>
      </div>
      <FamilySettings />
      <AccountSettings />
    </div>
  );
}
