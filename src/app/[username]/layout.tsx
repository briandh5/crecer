import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthPanel } from "@/components/AuthPanel";
import { PlantIcon } from "@/components/PlantIcon";
import { SwitchAccount } from "@/components/SwitchAccount";
import { StoreProvider } from "@/lib/store";
import { validateUsername } from "@/server/auth-core";
import { isDbConfigured } from "@/server/db";
import { getSessionUser } from "@/server/session";
import { loadState } from "@/server/state";

// Depende de la sesión (cookie): nunca se prerenderiza.
export const dynamic = "force-dynamic";

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center gap-6 px-4 py-10">{children}</div>;
}

export default async function ProfileLayout({ children, params }: { children: ReactNode; params: Promise<{ username: string }> }) {
  const { username } = await params;

  // Modo demo: sin cuenta, los datos viven en este dispositivo.
  if (username === "demo") {
    return (
      <StoreProvider mode="demo" username="demo">
        <AppShell>{children}</AppShell>
      </StoreProvider>
    );
  }

  const checked = validateUsername(decodeURIComponent(username));
  if (!checked.ok) notFound();
  if (checked.value !== username) redirect(`/${checked.value}`); // /Briandh444 → /briandh444

  if (!isDbConfigured()) {
    return (
      <Centered>
        <PlantIcon stage="brote" size={96} />
        <div className="card max-w-md space-y-3 text-center">
          <h1 className="text-2xl font-semibold">Las cuentas aún no están activas</h1>
          <p className="text-ink-soft">Este sitio todavía no tiene la base de datos conectada. Mientras tanto puedes probar la demo.</p>
          <Link href="/demo" className="btn-primary">Probar la demo</Link>
        </div>
      </Centered>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    return (
      <Centered>
        <PlantIcon stage="arbolito" size={96} />
        <div className="text-center">
          <h1 className="text-3xl font-semibold">Hola, @{username}</h1>
          <p className="mt-1 text-ink-soft">Entra con tu contraseña para ver tu perfil.</p>
        </div>
        <AuthPanel initialUsername={username} lockUsername />
        <Link href="/" className="text-sm font-bold text-moss hover:underline">¿No eres @{username}? Ir al inicio</Link>
      </Centered>
    );
  }

  if (session.username !== username) {
    return (
      <Centered>
        <SwitchAccount current={session.username} requested={username} />
      </Centered>
    );
  }

  const initial = await loadState(session.id);
  return (
    <StoreProvider mode="remote" username={username} initial={initial}>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
