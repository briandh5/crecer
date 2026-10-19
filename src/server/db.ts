import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

// Fechas como texto «YYYY-MM-DD» (sin convertirlas a Date, que dependería de la zona horaria) y numeric como número.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => Number.parseFloat(v));

export class DbNotConfiguredError extends Error {
  constructor() {
    super("La base de datos no está configurada (falta DATABASE_URL).");
  }
}

export const isDbConfigured = () => !!process.env.DATABASE_URL;

const g = globalThis as unknown as { __crecerPool?: Pool };

function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new DbNotConfiguredError();
  if (!g.__crecerPool) {
    const url = process.env.DATABASE_URL;
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    g.__crecerPool = new Pool({
      connectionString: url,
      // Supabase exige TLS; en local no hace falta.
      ssl: local ? false : { rejectUnauthorized: false },
      // Serverless: una conexión por instancia para no agotar el pooler.
      max: process.env.NODE_ENV === "production" ? 1 : 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
  }
  return g.__crecerPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return pool().query<T>(text, params);
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
