import Link from "next/link";
import type { ReactNode } from "react";
import { AcceptInvite } from "@/components/AcceptInvite";
import { AuthPanel } from "@/components/AuthPanel";
import { PlantIcon } from "@/components/PlantIcon";
import { hashToken } from "@/server/auth-core";
import { isDbConfigured, query } from "@/server/db";
import { isGoogleConfigured } from "@/server/google";
import { getSessionUser } from "@/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitación · Crecer" };

function Shell({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 py-10">
      <PlantIcon stage="arbolito" size={88} />
      <div className="text-center">
        <h1 className="text-3xl font-semibold">{title}</h1>
        {lead && <p className="mt-1 text-ink-soft">{lead}</p>}
      </div>
      {children}
    </main>
  );
}

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const raw = typeof token === "string" && token.length <= 100 ? token : "";

  const invite = raw && isDbConfigured()
    ? (
        await query<{ inviter: string; email: string }>(
          `select u.username as inviter, i.email from public.family_invites i join public.users u on u.id = i.inviter_id
            where i.token_hash = $1 and i.expires_at > now()`,
          [hashToken(raw)],
        )
      ).rows[0]
    : undefined;

  if (!invite) {
    return (
      <Shell title="Invitación no válida" lead="Caducó, se anuló o ya se usó. Pide a quien te invitó que te mande una nueva desde «Mi cuenta».">
        <Link href="/" className="btn-soft">Ir al inicio</Link>
      </Shell>
    );
  }

  const lead = (
    <>
      <strong className="text-ink">@{invite.inviter}</strong> te invitó a su familia: podrán ver y añadir juntos los datos de sus hijos.
    </>
  );
  const session = await getSessionUser();

  if (!session) {
    const next = `/invitacion?token=${encodeURIComponent(raw)}`;
    return (
      <Shell title="Te invitaron a Crecer" lead={lead}>
        <p className="text-center text-sm text-ink-soft">
          Entra o crea tu cuenta con <strong className="break-all text-ink">{invite.email}</strong> para aceptar.
        </p>
        <AuthPanel defaultTab="register" initialEmail={invite.email} next={next} google={isGoogleConfigured()} />
      </Shell>
    );
  }

  if (session.email !== invite.email) {
    return (
      <Shell title="Esta invitación es para otra cuenta" lead={lead}>
        <div className="card space-y-3 text-center">
          <p className="text-ink-soft">
            La invitación es para <strong className="break-all text-ink">{invite.email}</strong>, pero entraste como <strong className="text-ink">@{session.username}</strong>
            {session.email ? <> ({session.email})</> : null}.
          </p>
          <p className="text-sm text-ink-soft">Sal y entra con la cuenta de ese correo, o cambia el correo de esta cuenta en «Mi cuenta».</p>
          <Link href={`/${session.username}`} className="btn-soft">Ir a mi perfil</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Únete a la familia" lead={lead}>
      <div className="card w-full space-y-3">
        <p className="text-sm text-ink-soft">
          Al aceptar, tú y @{invite.inviter} verán los perfiles de los hijos de ambas cuentas y podrán añadir mediciones, vacunas, hitos y recuerdos. Cada quien puede salir de la familia cuando quiera desde «Mi cuenta».
        </p>
        <AcceptInvite token={raw} inviter={invite.inviter} />
      </div>
    </Shell>
  );
}
