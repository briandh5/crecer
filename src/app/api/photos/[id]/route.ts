import { z } from "zod";
import { query } from "@/server/db";
import { fail, handleError, sameOrigin } from "@/server/http";
import { getSessionUser } from "@/server/session";

const MAX_BYTES = 2_500_000;
const idSchema = z.string().uuid();

type Ctx = { params: Promise<{ id: string }> };

/** Foto de un recuerdo del diario. Solo la ve la cuenta dueña. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const id = idSchema.safeParse((await params).id);
    if (!id.success) return fail(404, "No encontrada.");
    const user = await getSessionUser();
    if (!user) return fail(401, "Inicia sesión para ver la foto.");
    const { rows } = await query<{ data: Buffer }>(
      `select p.data
         from public.journal_photos p
         join public.journal_entries j on j.id = p.entry_id
         join public.children c on c.id = j.child_id
        where p.entry_id = $1 and c.owner_id = $2`,
      [id.data, user.id],
    );
    if (!rows[0]) return fail(404, "No encontrada.");
    return new Response(new Uint8Array(rows[0].data), {
      headers: {
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff",
        // Cada foto tiene un id único y no se reemplaza: puede quedarse en la caché del navegador.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Sube (o reemplaza) la foto de un recuerdo propio. El cuerpo es el JPEG en bruto. */
export async function POST(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return fail(403, "Petición no permitida.");
  try {
    const id = idSchema.safeParse((await params).id);
    if (!id.success) return fail(404, "No encontrado.");
    const user = await getSessionUser();
    if (!user) return fail(401, "Tu sesión expiró. Vuelve a iniciar sesión.");

    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) return fail(413, "La foto es demasiado grande.");
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return fail(413, "La foto es demasiado grande.");
    // Solo JPEG real (la app convierte antes de subir): comprobamos la firma, no el tipo declarado.
    if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) return fail(415, "Formato de imagen no admitido.");

    const { rowCount } = await query(
      `insert into public.journal_photos (entry_id, mime, data)
       select j.id, 'image/jpeg', $3
         from public.journal_entries j join public.children c on c.id = j.child_id
        where j.id = $1 and c.owner_id = $2
       on conflict (entry_id) do update set data = excluded.data, created_at = now()`,
      [id.data, user.id, buf],
    );
    if (!rowCount) return fail(404, "No encontrado.");
    return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
