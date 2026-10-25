// Postgres local embebido (binarios de @embedded-postgres/windows-x64, se instalan con `npm ci`).
// Uso: tsx scripts/db.ts start | stop | status
// `start` crea el cluster la primera vez, lo arranca en segundo plano (sigue corriendo aunque
// se cierre la consola) y crea la base si falta. Escucha solo en localhost.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initdb, pg_ctl } from "@embedded-postgres/windows-x64";
import { Client } from "pg";
import { PG_DATA_DIR, PG_DATABASE, PG_PASSWORD, PG_PORT, PG_USER } from "../src/lib/config";

const LOG_FILE = path.join(path.dirname(PG_DATA_DIR), "postgres.log");

export function isRunning() {
  if (!fs.existsSync(path.join(PG_DATA_DIR, "PG_VERSION"))) return false;
  return spawnSync(pg_ctl, ["status", "-D", PG_DATA_DIR]).status === 0;
}

function initCluster() {
  console.log(`Creando la base de datos local en ${PG_DATA_DIR} ...`);
  fs.mkdirSync(PG_DATA_DIR, { recursive: true });
  const pwfile = path.join(os.tmpdir(), `frabel-pg-${process.pid}.txt`);
  fs.writeFileSync(pwfile, PG_PASSWORD);
  try {
    execFileSync(
      initdb,
      [
        "-D", PG_DATA_DIR,
        "-U", PG_USER,
        `--pwfile=${pwfile}`,
        "--auth=scram-sha-256",
        "--encoding=UTF8",
        // Orden alfabético en español (Á junto a A, Ñ después de N).
        "--locale-provider=icu",
        "--icu-locale=es-AR",
        "--locale=C",
      ],
      { stdio: "inherit" },
    );
  } finally {
    fs.rmSync(pwfile, { force: true });
  }
}

async function ensureDatabase() {
  const client = new Client({ host: "localhost", port: PG_PORT, user: PG_USER, password: PG_PASSWORD, database: "postgres" });
  await client.connect();
  try {
    const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [PG_DATABASE]);
    if (!rowCount) {
      await client.query(`create database "${PG_DATABASE}"`);
      console.log(`Base "${PG_DATABASE}" creada.`);
    }
  } finally {
    await client.end();
  }
}

export async function startDb() {
  if (!fs.existsSync(path.join(PG_DATA_DIR, "PG_VERSION"))) initCluster();
  if (!isRunning()) {
    console.log(`Iniciando Postgres en el puerto ${PG_PORT} (log: ${LOG_FILE}) ...`);
    // stdio "ignore": si postgres heredara la consola, quien lanzó este script nunca vería el fin de la salida.
    execFileSync(pg_ctl, ["start", "-D", PG_DATA_DIR, "-o", `-p ${PG_PORT}`, "-l", LOG_FILE, "-w", "-t", "60"], {
      stdio: "ignore",
    });
  }
  await ensureDatabase();
}

export function stopDb() {
  if (!isRunning()) return console.log("Postgres no estaba corriendo.");
  execFileSync(pg_ctl, ["stop", "-D", PG_DATA_DIR, "-m", "fast", "-w"], { stdio: "inherit" });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename ?? "");
if (isMain) {
  const cmd = process.argv[2];
  if (cmd === "start") {
    startDb().then(() => console.log("Postgres listo."), (e) => { console.error(e); process.exit(1); });
  } else if (cmd === "stop") {
    stopDb();
  } else if (cmd === "status") {
    console.log(isRunning() ? `Postgres corriendo (puerto ${PG_PORT}, datos en ${PG_DATA_DIR}).` : "Postgres detenido.");
  } else {
    console.log("Uso: tsx scripts/db.ts start | stop | status");
    process.exit(1);
  }
}
