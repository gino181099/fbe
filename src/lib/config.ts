// Configuración fija del ERP local. Va en el código a propósito (decisión de la empresa:
// corre en una PC de la oficina, no hay nada que ocultar). `process.env` solo sobreescribe para pruebas.
import os from "node:os";
import path from "node:path";

/** Clave única para entrar al ERP. */
export const ACCESS_PASSWORD = "belinda2156";

/** Firma de las sesiones (JWT). Cambiarla cierra todas las sesiones abiertas. */
export const AUTH_SECRET = "frabel-erp-local-3f9c2a7e5b1d4086a2c4e8f1b7d9a3c5";

export const PG_PORT = Number(process.env.PG_PORT ?? 5433);
export const PG_USER = "postgres";
export const PG_PASSWORD = "belinda2156";
export const PG_DATABASE = "frabel";

/**
 * Datos separados del código: el repo (C:\FrabelERP) se actualiza con git y nunca toca esta carpeta.
 * Ruta fija de la PC (no del usuario de Windows) y fuera de OneDrive (bloquea/corrompe los archivos de la base).
 */
export const DATA_ROOT = process.env.FRABEL_DATA_DIR ?? (process.platform === "win32" ? "C:\\FrabelERP-datos" : path.join(os.homedir(), "FrabelERP-datos"));
export const PG_DATA_DIR = process.env.PG_DATA_DIR ?? path.join(DATA_ROOT, "postgres");
export const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(DATA_ROOT, "backups");

export const DATABASE_URL =
  process.env.DATABASE_URL ?? `postgres://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DATABASE}`;
