// Copias de la base (Neon, `DATABASE_URL` de .env.local). Sin pg_dump: se hace en Node, tabla por tabla.
// Uso:
//   tsx scripts/datos.ts backup                      → backups/frabel-AAAA-MM-DD-HHMM.json.gz
//   tsx scripts/datos.ts restore <archivo>           → reemplaza toda la base (antes hace backup)
// Los valores viajan como texto (sin conversiones de JS), así fechas y montos quedan idénticos.
// El volcado tiene que ser de la misma migración que la base o de una anterior (las migraciones son aditivas).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { Client } from "pg";
import { DATABASE_URL } from "../src/lib/config";
import { type Dump, dumpFileName, dumpMigrationAt, migrations, q, rawTypes, readAll, tableNames } from "../src/lib/db-dump";
import { pgConnection } from "../src/lib/pg-connection";

const KEEP_BACKUPS = 60;
const BACKUP_DIR = path.join(process.cwd(), "backups");

const connect = (url: string) => new Client({ ...pgConnection(url), types: rawTypes });

/** Migraciones del repo (cada .sql con su fecha del journal), para fechar volcados que solo traen el hash. */
function repoMigrationFiles() {
  const dir = path.join(process.cwd(), "drizzle");
  const journal = JSON.parse(fs.readFileSync(path.join(dir, "meta", "_journal.json"), "utf8")) as {
    entries: { tag: string; when: number }[];
  };
  return journal.entries.map((e) => ({ sql: fs.readFileSync(path.join(dir, `${e.tag}.sql`), "utf8"), when: e.when }));
}

async function rowCount(c: Client, t: string) {
  const { rows } = await c.query(`select count(*) as n from ${q(t)}`);
  return Number(rows[0].n);
}

/** ¿Tiene datos cargados por la gente? (las migraciones siembran usuarios/vehículos/choferes/proveedores: no cuentan) */
async function hasBusinessData(c: Client) {
  for (const t of ["client", "trip", "expense"]) if ((await rowCount(c, t)) > 0) return true;
  return false;
}

/** Tablas ordenadas para insertar: primero las referenciadas por claves foráneas (las autorreferencias no cuentan). */
async function insertOrder(c: Client, tables: string[]) {
  const { rows } = await c.query(
    `select cl.relname as t, ref.relname as r from pg_constraint k
     join pg_class cl on cl.oid = k.conrelid join pg_class ref on ref.oid = k.confrelid
     where k.contype = 'f' and k.connamespace = 'public'::regnamespace and k.conrelid <> k.confrelid`,
  );
  const deps = new Map(tables.map((t) => [t, new Set(rows.filter((r) => r.t === t).map((r) => r.r as string))]));
  const order: string[] = [];
  while (order.length < tables.length) {
    const ready = tables.filter((t) => !order.includes(t) && [...deps.get(t)!].every((r) => order.includes(r) || !deps.has(r)));
    if (!ready.length) throw new Error("Claves foráneas circulares: no se puede ordenar la carga.");
    order.push(...ready);
  }
  return order;
}

/**
 * Reemplaza todo el contenido de la base por el volcado, en una transacción (o todo o nada).
 * Antes guarda un backup de lo que había, si había datos.
 */
async function writeAll(dump: Dump) {
  const c = connect(DATABASE_URL);
  await c.connect();
  try {
    // Se compara por fecha de migración, no por hash: el hash depende de los finales de línea del .sql en cada PC.
    const localAt = (await migrations(c)).at(-1)?.at ?? null;
    const dumpAt = dumpMigrationAt(dump, repoMigrationFiles());
    if (dumpAt === undefined || (dumpAt !== null && (localAt === null || dumpAt > localAt))) {
      throw new Error("El volcado es de una versión más nueva del ERP que esta. Actualizar (git pull + npm run db:migrate) antes.");
    }
    if (dumpAt !== localAt) console.log("Aviso: el volcado es de una versión anterior; se carga igual.");
    const localTables = await tableNames(c);
    if (await hasBusinessData(c)) await backup();
    const order = await insertOrder(c, Object.keys(dump.tables));
    await c.query("begin");
    if (localTables.length) await c.query(`truncate ${localTables.map(q).join(", ")} cascade`);
    // Neon no deja apagar las claves foráneas (session_replication_role): se carga cada tabla después de las que referencia.
    for (const t of order) {
      const { columns, rows } = dump.tables[t];
      if (!localTables.includes(t)) throw new Error(`La tabla ${t} no existe en la base.`);
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

async function readDb() {
  const c = connect(DATABASE_URL);
  await c.connect();
  try {
    return await readAll(c);
  } finally {
    await c.end();
  }
}

function writeDumpFile(dump: Dump, file: string, label: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(dump)));
  const total = Object.values(dump.tables).reduce((s, t) => s + t.rows.length, 0);
  console.log(`${label}: ${file} (${total} filas)`);
}

const readDumpFile = (file: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8")) as Dump;

export async function backup() {
  const file = path.join(BACKUP_DIR, dumpFileName());
  writeDumpFile(await readDb(), file, "Backup");
  // Se conservan los últimos KEEP_BACKUPS.
  const old = fs.readdirSync(BACKUP_DIR).filter((f) => /^frabel-.*\.json\.gz$/.test(f)).sort().slice(0, -KEEP_BACKUPS);
  for (const f of old) fs.rmSync(path.join(BACKUP_DIR, f));
  return file;
}

async function restore(file: string) {
  await writeAll(readDumpFile(file));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename ?? "");
if (isMain) {
  const [cmd, arg] = process.argv.slice(2);
  const run =
    cmd === "backup"
      ? backup()
      : cmd === "restore" && arg
        ? restore(arg)
        : Promise.reject(new Error("Uso: tsx scripts/datos.ts backup | restore <archivo>"));
  run.catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
