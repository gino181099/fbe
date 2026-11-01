// Configuración del ERP: viene del entorno (variables de Vercel en producción, `.env.local` en esta PC).
// Ver `.env.example`.

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} (ver .env.example).`);
  return value;
}

/** URL de la base de Neon (la "-pooler"). */
export const DATABASE_URL = required("DATABASE_URL");

/** Clave única para entrar al ERP. */
export const ACCESS_PASSWORD = required("ACCESS_PASSWORD");

/** Firma de las sesiones (JWT). Cambiarla cierra todas las sesiones abiertas. */
export const AUTH_SECRET = required("AUTH_SECRET");
