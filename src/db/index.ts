import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DATABASE_URL } from "../lib/config";
import { pgConnection } from "../lib/pg-connection";
import * as schema from "./schema";

// Un solo pool por instancia (el hot reload de `next dev` reevalúa este módulo). En Vercel cada
// instancia tiene su pool y el pooler de Neon reparte. max 10: Inicio lanza ~15 consultas a la vez.
// Conexiones vivas 5 min: abrir una nueva (TLS + auth) cuesta mucho más que la consulta.
const globalForDb = globalThis as unknown as { pgPool?: Pool };
const pool =
  globalForDb.pgPool ??
  new Pool({ ...pgConnection(DATABASE_URL), max: 10, idleTimeoutMillis: 300_000, allowExitOnIdle: true });
globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema, pool };
