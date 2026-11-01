import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DATABASE_URL } from "../lib/config";
import { pgConnection } from "../lib/pg-connection";
import * as schema from "./schema";

// Un solo pool por instancia (el hot reload de `next dev` reevalúa este módulo). Pocas conexiones:
// en Vercel cada instancia tiene su pool y el pooler de Neon reparte.
const globalForDb = globalThis as unknown as { pgPool?: Pool };
const pool =
  globalForDb.pgPool ?? new Pool({ ...pgConnection(DATABASE_URL), max: 5, idleTimeoutMillis: 10_000, allowExitOnIdle: true });
globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema, pool };
