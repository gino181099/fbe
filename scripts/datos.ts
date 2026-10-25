// Copias de la base local (el paquete embebido no trae pg_dump: se hace en Node, tabla por tabla).
// Uso:
//   tsx scripts/datos.ts backup                      → BACKUP_DIR/frabel-AAAA-MM-DD-HHMM.json.gz
//   tsx scripts/datos.ts restore <archivo>           → reemplaza la base local (antes hace backup)
//   tsx scripts/datos.ts copiar-neon                 → ídem, trayendo todo desde NEON_DATABASE_URL (una sola vez)
//   tsx scripts/datos.ts exportar-inicial            → datos-iniciales/frabel-inicial.json.gz (va al repo)
//   tsx scripts/datos.ts inicializar                 → carga los datos iniciales SOLO si la base no tiene datos
// Los valores viajan como texto (sin conversiones de JS), así fechas y montos quedan idénticos.
// El volcado tiene que ser de la misma migración que la base o de una anterior (las migraciones son aditivas).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { Client } from "pg";
import { BACKUP_DIR, DATABASE_URL } from "../src/lib/config";

type TableDump = { columns: string[]; rows: (string | null)[][] };
type Dump = { version: 1; createdAt: string; migration: string | null; tables: Record<string, TableDump> };

const KEEP_BACKUPS = 60;
const INITIAL_FILE = path.join(process.cwd(), "datos-iniciales", "frabel-inicial.json.gz");
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

async function migrations(c: Client) {
  const { rows } = await c.query(`select hash from drizzle.__drizzle_migrations order by created_at`);
  return rows.map((r) => r.hash as string);
}

async function lastMigration(c: Client) {
  return (await migrations(c)).at(-1) ?? null;
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

/** ¿Tiene datos cargados por la gente? (las migraciones siembran usuarios/vehículos/choferes/proveedores: no cuentan) */
async function hasBusinessData(c: Client) {
  for (const t of ["client", "trip", "expense"]) if ((await rowCount(c, t)) > 0) return true;
  return false;
}

/**
 * Reemplaza todo el contenido de la base local por el volcado, en una transacción (o todo o nada).
 * Antes guarda un backup de lo que había, si había datos.
 */
async function writeAll(dump: Dump) {
  const c = connect(DATABASE_URL);
  await c.connect();
  try {
    const local = await migrations(c);
    if (dump.migration && !local.includes(dump.migration)) {
      throw new Error("El volcado es de una versión más nueva del ERP que esta. Actualizar (git pull + npm run db:migrate) antes.");
    }
    if (dump.migration !== local.at(-1)) console.log("Aviso: el volcado es de una versión anterior; se carga igual.");
    const localTables = await tableNames(c);
    if (await hasBusinessData(c)) await backup();
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

async function readLocal() {
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
  const stamp = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 16);
  const file = path.join(BACKUP_DIR, `frabel-${stamp.replace(" ", "-").replace(":", "")}.json.gz`);
  writeDumpFile(await readLocal(), file, "Backup");
  // Se conservan los últimos KEEP_BACKUPS.
  const old = fs.readdirSync(BACKUP_DIR).filter((f) => /^frabel-.*\.json\.gz$/.test(f)).sort().slice(0, -KEEP_BACKUPS);
  for (const f of old) fs.rmSync(path.join(BACKUP_DIR, f));
  return file;
}

async function restore(file: string) {
  await writeAll(readDumpFile(file));
}

/** En la PC de desarrollo: deja la base actual como punto de partida de producción (se sube al repo). */
async function exportInitial() {
  writeDumpFile(await readLocal(), INITIAL_FILE, "Datos iniciales");
  console.log('Ahora: git add datos-iniciales && git commit -m "Datos iniciales" && git push');
}

/** En la instalación: carga los datos iniciales solo si la base está vacía. Nunca pisa datos de producción. */
async function initialize() {
  const c = connect(DATABASE_URL);
  await c.connect();
  const hasData = await hasBusinessData(c).finally(() => c.end());
  if (hasData) return console.log("La base ya tiene datos: no se cargan los datos iniciales.");
  if (!fs.existsSync(INITIAL_FILE)) return console.log("No hay datos iniciales en el repo: la base arranca vacía.");
  const dump = readDumpFile(INITIAL_FILE);
  console.log(`Cargando datos iniciales (exportados el ${dump.createdAt.slice(0, 10)}) ...`);
  await writeAll(dump);
}

async function copyFromNeon() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) throw new Error("Falta NEON_DATABASE_URL (en .env.local).");
  const c = connect(url);
  await c.connect();
  const dump = await readAll(c).finally(() => c.end());
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
          : cmd === "exportar-inicial"
            ? exportInitial()
            : cmd === "inicializar"
              ? initialize()
              : Promise.reject(
                  new Error("Uso: tsx scripts/datos.ts backup | restore <archivo> | copiar-neon | exportar-inicial | inicializar"),
                );
  run.catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
