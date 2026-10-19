// Traducción de errores de Postgres (neon-http envuelve el error original en `cause`).

export function pgCode(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
}

/** Violación de índice único (23505). */
export const isUniqueViolation = (e: unknown) => pgCode(e) === "23505";
