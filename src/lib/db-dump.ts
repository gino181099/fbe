// Volcado completo de la base (tabla por tabla, valores como texto). Lo usan `scripts/datos.ts`
// (backup / restore) y la descarga de la copia desde la app (`/api/copia-base`): mismo formato .json.gz.
// Sin `server-only` ni `@/db` a propósito: también lo importa el script con tsx.
import { createHash } from "node:crypto";
import type { Client } from "pg";

export type TableDump = { columns: string[]; rows: (string | null)[][] };
/**
 * `migration` = hash de la última migración aplicada (cambia según los finales de línea del .sql en cada PC);
 * `migrationAt` = su fecha (`created_at`, igual en todas las PCs): es la que se usa para comparar versiones.
 * Los volcados viejos no traen `migrationAt`.
 */
export type Dump = {
  version: 1;
  createdAt: string;
  migration: string | null;
  migrationAt?: number | null;
  tables: Record<string, TableDump>;
};

/** Para `new Client({ types })`: todo llega como texto, así fechas y montos quedan idénticos. */
export const rawTypes = { getTypeParser: () => (v: string) => v };

export const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** Migraciones aplicadas, de la más vieja a la más nueva (`at` = created_at en ms). */
export async function migrations(c: Client) {
  const { rows } = await c.query(`select hash, created_at from drizzle.__drizzle_migrations order by created_at`);
  return rows.map((r) => ({ hash: r.hash as string, at: Number(r.created_at) }));
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
  const last = (await migrations(c)).at(-1);
  return { version: 1, createdAt: new Date().toISOString(), migration: last?.hash ?? null, migrationAt: last?.at ?? null, tables };
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Fecha de la última migración de un volcado. Los volcados viejos solo traen el hash: se busca entre las
 * migraciones del repo (`files` = cada .sql con su `when` del journal) probando LF y CRLF, porque git en
 * Windows puede bajar los .sql con cualquiera de los dos. null = el volcado no tiene migraciones;
 * undefined = no se encontró (es de una versión que este repo no tiene).
 */
export function dumpMigrationAt(dump: Pick<Dump, "migration" | "migrationAt">, files: { sql: string; when: number }[]) {
  if (dump.migrationAt != null) return dump.migrationAt;
  if (!dump.migration) return null;
  for (const { sql, when } of files) {
    const lf = sql.replace(/\r\n/g, "\n");
    if (sha256(lf) === dump.migration || sha256(lf.replace(/\n/g, "\r\n")) === dump.migration) return when;
  }
  return undefined;
}

/** frabel-AAAA-MM-DD-HHMM.json.gz con la hora de Argentina (el nombre que usan los backups). */
export function dumpFileName(date = new Date()) {
  const stamp = date.toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 16);
  return `frabel-${stamp.replace(" ", "-").replace(":", "")}.json.gz`;
}
