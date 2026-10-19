import Link from "next/link";
import { PlantIcon } from "@/components/PlantIcon";
import { ResetForm } from "@/components/ResetForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nueva contraseña · Crecer", referrer: "no-referrer" as const };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 py-10">
      <PlantIcon stage="arbolito" size={88} />
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Elige una contraseña nueva</h1>
      </div>
      {typeof token === "string" && token ? (
        <ResetForm token={token} />
      ) : (
        <div className="card space-y-3 text-center">
          <p className="text-ink-soft">Este enlace está incompleto. Pide uno nuevo para continuar.</p>
          <Link href="/recuperar" className="btn-primary">Pedir un enlace</Link>
        </div>
      )}
    </main>
  );
}
