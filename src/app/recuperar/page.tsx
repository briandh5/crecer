import Link from "next/link";
import { ForgotForm } from "@/components/ForgotForm";
import { PlantIcon } from "@/components/PlantIcon";
import { isMailConfigured } from "@/server/mail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recuperar contraseña · Crecer" };

export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await searchParams;
  const initial = typeof u === "string" ? u.slice(0, 254) : "";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 py-10">
      <PlantIcon stage="brote" size={88} />
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Recuperar contraseña</h1>
        <p className="mt-1 text-ink-soft">Te enviamos un enlace por correo para elegir una nueva.</p>
      </div>
      {isMailConfigured() ? (
        <ForgotForm initial={initial} />
      ) : (
        <div className="card space-y-3 text-center">
          <p className="text-ink-soft">La recuperación por correo todavía no está activada en este sitio.</p>
          <Link href="/" className="btn-soft">Volver al inicio</Link>
        </div>
      )}
    </main>
  );
}
