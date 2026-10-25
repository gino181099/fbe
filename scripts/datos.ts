// Copias de la base local (el paquete embebido no trae pg_dump: se hace en Node, tabla por tabla).
// Uso:
//   tsx scripts/datos.ts backup                      → BACKUP_DIR/frabel-AAAA-MM-DD-HHMM.json.gz
//   tsx scripts/datos.ts restore <archivo>           → reemplaza la base local (antes hace backup)
//   tsx scripts/datos.ts copiar-neon                 → ídem, trayendo todo desde NEON_DATABASE_URL (una sola vez)
// Los valores viajan como texto (sin conversiones de JS), así fechas y montos quedan idénticos.
// Origen y destino tienen que tener aplicadas las mismas migraciones.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { Client } from "pg";
import { BACKUP_DIR, DATABASE_URL } from "../src/lib/config";

type TableDump = { columns: string[]; rows: (string | null)[][] };
type Dump = { version: 1; createdAt: string; migration: string | null; tables: Record<string, TableDump> };

const KEEP_BACKUPS = 60;
const rawTypes = { getTypeParser: () => (v: string) => v };

function connect(url: string) {
  // Neon exige SSL; se quita `sslmode` de la URL para que pg no lo reinterprete (y no avise).
  const u = new URL(url);
  const remote = !["localhost", "127.0.0.1"].includes(u.hostname);
  u.searchParams.delete("sslmode");
  u.searchParams.delete("channel_binding");
  return new Client({ connectionString: u.toString(), ssl: remote ? true : undefined, types: rawTypes });
}

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function lastMigration(c: Client) {
  const { rows } = await c.query(`select hash from drizzle.__drizzle_migrations order by created_at desc limit 1`);
  return (rows[0]?.hash as string | undefined) ?? null;
}

async function tableNames(c: Client) {
  const { rows } = await c.query(
    `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  return rows.map((r) => r.table_name as string);
}

async function readAll(c: Client): Promise<Dump> {
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
  return { version: 1, createdAt: new Date().toISOString(), migration: await lastMigration(c), tables };
}

async function rowCount(c: Client, t: string) {
  const { rows } = await c.query(`select count(*) as n from ${q(t)}`);
  return Number(rows[0].n);
}

/**
 * Reemplaza todo el contenido de la base local por el volcado, en una transacción (o todo o nada).
 * Antes guarda un backup de lo que había, si había algo.
 */
async function writeAll(dump: Dump) {
  const c = connect(DATABASE_URL);
  await c.connect();
  try {
    const local = await lastMigration(c);
    if (dump.migration !== local) {
      throw new Error("Las migraciones del origen y de la base local no coinciden. Correr `npm run db:migrate` (o actualizar el origen) antes.");
    }
    const localTables = await tableNames(c);
    let hasData = false;
    for (const t of localTables) hasData ||= (await rowCount(c, t)) > 0;
    if (hasData) await backup();
    await c.query("begin");
    // Sin chequeo de claves foráneas ni triggers durante la carga: el orden de las tablas no importa.
    await c.query("set local session_replication_role = replica");
    if (localTables.length) await c.query(`truncate ${localTables.map(q).join(", ")} cascade`);
    for (const [t, { columns, rows }] of Object.entries(dump.tables)) {
      if (!localTables.includes(t)) throw new Error(`La tabla ${t} no existe en la base local.`);
      const perRow = columns.length;
      const chunk = Math.max(1, Math.floor(30000 / perRow));
      for (let i = 0; i < rows.length; i += chunk) {
        const slice = rows.slice(i, i + chunk);
        const values = slice.map((_, r) => `(${columns.map((_, k) => `$${r * perRow + k + 1}`).join(", ")})`).join(", ");
        await c.query(
          `insert into ${q(t)} (${columns.map(q).join(", ")}) overriding system value values ${values}`,
          slice.flat(),
        );
      }
    }
    // Las secuencias (ids) siguen desde el máximo cargado.
    const seqs = await c.query(
      `select table_name, column_name, pg_get_serial_sequence(quote_ident(table_name), column_name) as seq
       from information_schema.columns where table_schema = 'public'`,
    );
    for (const s of seqs.rows.filter((r) => r.seq)) {
      await c.query(
        `select setval($1, coalesce((select max(${q(s.column_name)}) from ${q(s.table_name)}), 0) + 1, false)`,
        [s.seq],
      );
    }
    await c.query("commit");
    for (const [t, { rows }] of Object.entries(dump.tables)) {
      const n = await rowCount(c, t);
      console.log(`${n === rows.length ? "OK " : "ERR"} ${t}: ${n}/${rows.length}`);
      if (n !== rows.length) process.exitCode = 1;
    }
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

export async function backup() {
  const c = connect(DATABASE_URL);
  await c.connect();
  let dump: Dump;
  try {
    dump = await readAll(c);
  } finally {
    await c.end();
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 16);
  const file = path.join(BACKUP_DIR, `frabel-${stamp.replace(" ", "-").replace(":", "")}.json.gz`);
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(dump)));
  const total = Object.values(dump.tables).reduce((s, t) => s + t.rows.length, 0);
  console.log(`Backup: ${file} (${total} filas)`);
  // Se conservan los últimos KEEP_BACKUPS.
  const old = fs.readdirSync(BACKUP_DIR).filter((f) => /^frabel-.*\.json\.gz$/.test(f)).sort().slice(0, -KEEP_BACKUPS);
  for (const f of old) fs.rmSync(path.join(BACKUP_DIR, f));
  return file;
}

async function restore(file: string) {
  await writeAll(JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8")) as Dump);
}

async function copyFromNeon() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) throw new Error("Falta NEON_DATABASE_URL (en .env.local).");
  const c = connect(url);
  await c.connect();
  let dump: Dump;
  try {
    dump = await readAll(c);
  } finally {
    await c.end();
  }
  await writeAll(dump);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename ?? "");
if (isMain) {
  const [cmd, arg] = process.argv.slice(2);
  const run =
    cmd === "backup"
      ? backup()
      : cmd === "restore" && arg
        ? restore(arg)
        : cmd === "copiar-neon"
          ? copyFromNeon()
          : Promise.reject(new Error("Uso: tsx scripts/datos.ts backup | restore <archivo> | copiar-neon"));
  run.catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
