// Volcado completo de la base (tabla por tabla, valores como texto). Lo usan `scripts/datos.ts`
// (backup / restore) y la descarga de la copia desde la app (`/api/copia-base`): mismo formato .json.gz.
// Sin `server-only` ni `@/db` a propósito: también lo importa el script con tsx.
import type { Client } from "pg";

export type TableDump = { columns: string[]; rows: (string | null)[][] };
export type Dump = { version: 1; createdAt: string; migration: string | null; tables: Record<string, TableDump> };

/** Para `new Client({ types })`: todo llega como texto, así fechas y montos quedan idénticos. */
export const rawTypes = { getTypeParser: () => (v: string) => v };

export const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

export async function migrations(c: Client) {
  const { rows } = await c.query(`select hash from drizzle.__drizzle_migrations order by created_at`);
  return rows.map((r) => r.hash as string);
}

export async function tableNames(c: Client) {
  const { rows } = await c.query(
    `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  return rows.map((r) => r.table_name as string);
}

export async function readAll(c: Client): Promise<Dump> {
  const tables: Record<string, TableDump> = {};
  for (const t of await tableNames(c)) {
    const cols = await c.query(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = $1 and is_generated = 'NEVER' order by ordinal_position`,
      [t],
    );
    const columns = cols.rows.map((r) => r.column_name as string);
    const res = await c.query({ text: `select ${columns.map(q).join(", ")} from ${q(t)}`, rowMode: "array" });
    tables[t] = { columns, rows: res.rows };
  }
  return { version: 1, createdAt: new Date().toISOString(), migration: (await migrations(c)).at(-1) ?? null, tables };
}

/** frabel-AAAA-MM-DD-HHMM.json.gz con la hora de Argentina (el nombre que usan los backups). */
export function dumpFileName(date = new Date()) {
  const stamp = date.toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 16);
  return `frabel-${stamp.replace(" ", "-").replace(":", "")}.json.gz`;
}
