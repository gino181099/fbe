// Traducción de errores de Postgres (Drizzle envuelve el error original de `pg` en `cause`).

export function pgCode(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
}

/** Violación de índice único (23505). */
export const isUniqueViolation = (e: unknown) => pgCode(e) === "23505";

/** FK en uso al borrar: ON DELETE RESTRICT dispara 23001; NO ACTION, 23503. */
export const isInUse = (e: unknown) => ["23001", "23503"].includes(pgCode(e) ?? "");
