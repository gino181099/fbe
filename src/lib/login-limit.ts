// Límite de intentos de login (lógica pura; la consulta a la base está en src/auth.ts).

/** Intentos fallidos permitidos por IP dentro de la ventana; al llegar, se bloquea hasta que salga el más viejo. */
export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** IP del cliente. En Vercel `x-real-ip` y `x-forwarded-for` los pone el proxy (no se pueden falsear). */
export function clientIp(headers: Headers) {
  return headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0].trim() || "desconocida";
}

/** Minutos que faltan para poder volver a intentar (0 = no está bloqueado). `failures`: fallos dentro de la ventana. */
export function blockedMinutes(failures: Date[], now: Date) {
  const recent = failures.filter((d) => now.getTime() - d.getTime() < LOGIN_WINDOW_MS).sort((a, b) => b.getTime() - a.getTime());
  if (recent.length < MAX_LOGIN_FAILURES) return 0;
  const unblockAt = recent[MAX_LOGIN_FAILURES - 1].getTime() + LOGIN_WINDOW_MS;
  return Math.max(1, Math.ceil((unblockAt - now.getTime()) / 60000));
}
