import { query } from "./db";

/** ¿Se superó el máximo de eventos del «cubo» en la ventana indicada? */
export async function isLimited(bucket: string, max: number, windowSeconds: number): Promise<boolean> {
  const { rows } = await query<{ n: string }>(
    `select count(*)::text as n from public.rate_events where bucket = $1 and at > now() - make_interval(secs => $2)`,
    [bucket, windowSeconds],
  );
  return Number(rows[0].n) >= max;
}

export async function record(bucket: string): Promise<void> {
  await query(`insert into public.rate_events (bucket) values ($1)`, [bucket]);
  // Limpieza oportunista de eventos antiguos.
  await query(`delete from public.rate_events where at < now() - interval '1 day'`).catch(() => {});
}

export async function clear(bucket: string): Promise<void> {
  await query(`delete from public.rate_events where bucket = $1`, [bucket]);
}
