import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DATABASE_URL } from "../lib/config";
import * as schema from "./schema";

// Un solo pool por proceso (el hot reload de `next dev` reevalúa este módulo).
const globalForDb = globalThis as unknown as { pgPool?: Pool };
const pool = globalForDb.pgPool ?? new Pool({ connectionString: DATABASE_URL, max: 10, allowExitOnIdle: true });
globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema, pool };
