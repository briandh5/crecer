import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { PlantIcon } from "@/components/PlantIcon";
import { isDbConfigured } from "@/server/db";
import { getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

const POINTS = [
  "Curvas de peso y talla con la mediana de referencia",
  "Cartilla de vacunación con recordatorios para tu calendario",
  "Hitos del desarrollo por edad y por área",
  "Diario de primeros logros, con fotos",
];

export default async function Landing() {
  const configured = isDbConfigured();
  const session = configured ? await getSessionUser() : null;
  if (session) redirect(`/${session.username}`);

  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-4 py-10 lg:grid-cols-[1fr_auto] lg:gap-16">
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <PlantIcon stage="arbolito" size={64} />
          <span className="font-display text-4xl font-bold text-moss">Crecer</span>
        </div>
        <h1 className="max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">Acompaña su crecimiento, del brote al árbol</h1>
        <p className="max-w-xl text-lg text-ink-soft">
          Un lugar tranquilo para llevar el desarrollo de tus hijos desde el nacimiento hasta la adolescencia, y encontrarlo desde cualquier dispositivo.
        </p>
        <ul className="hidden space-y-2 text-ink-soft lg:block">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-3">
              <span aria-hidden className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sage" />
              {p}
            </li>
          ))}
        </ul>
        <Link href="/demo" className="btn-soft">Probar la demo sin cuenta</Link>
      </section>

      {configured ? (
        <AuthPanel />
      ) : (
        <div className="card max-w-md space-y-2">
          <h2 className="text-xl font-semibold">Cuentas próximamente</h2>
          <p className="text-ink-soft">Aún no se pueden crear cuentas en este sitio. La demo ya funciona y guarda los datos en tu dispositivo.</p>
        </div>
      )}
    </main>
  );
}
