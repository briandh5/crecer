import { query } from "./db";

/**
 * Subconsulta SQL con los ids de las cuentas cuyos hijos puede ver y editar el usuario del parámetro `param`
 * (p. ej. "$2"): la suya y las enlazadas con ella en «Familia». Se usa como `c.owner_id in ${familyOwners("$2")}`.
 */
export const familyOwners = (param: string) =>
  `(select ${param}::uuid
     union select case when f.a = ${param}::uuid then f.b else f.a end
             from public.family_links f where f.a = ${param}::uuid or f.b = ${param}::uuid)`;

/** Días de vigencia de una invitación. */
export const INVITE_DAYS = 7;

export interface FamilyInfo {
  members: { id: string; username: string; email: string | null }[];
  pending: { email: string; expiresAt: string }[];
}

export async function familyInfo(userId: string): Promise<FamilyInfo> {
  const [members, pending] = await Promise.all([
    query<{ id: string; username: string; email: string | null }>(
      `select u.id, u.username, u.email from public.users u
        where u.id in ${familyOwners("$1")} and u.id <> $1 order by u.username`,
      [userId],
    ),
    query<{ email: string; expiresAt: string }>(
      `select email, to_char(expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "expiresAt"
         from public.family_invites where inviter_id = $1 and expires_at > now() order by created_at`,
      [userId],
    ),
  ]);
  return { members: members.rows, pending: pending.rows };
}

/** Enlaza dos cuentas (sin importar el orden). */
export async function linkFamily(x: string, y: string): Promise<void> {
  const [a, b] = x < y ? [x, y] : [y, x];
  await query(`insert into public.family_links (a, b) values ($1, $2) on conflict do nothing`, [a, b]);
}

export async function unlinkFamily(x: string, y: string): Promise<void> {
  const [a, b] = x < y ? [x, y] : [y, x];
  await query(`delete from public.family_links where a = $1 and b = $2`, [a, b]);
}
