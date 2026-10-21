import "server-only";
import { asc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, users } from "@/db/schema";

/** Nombre visible de un usuario (para responsables y autores). */
export const userName = sql<string | null>`coalesce(${users.name}, ${users.username}, ${users.email})`;

/** Opciones de cliente y responsable para el formulario de oportunidad. */
export async function leadFormOptions() {
  const [clientOptions, userOptions] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(ne(clients.type, "potencial"))
      .orderBy(asc(clients.name)),
    db
      .select({ id: users.id, name: sql<string>`coalesce(${userName}, 'Usuario')` })
      .from(users)
      .where(eq(users.status, "active"))
      .orderBy(asc(userName)),
  ]);
  return { clientOptions, userOptions };
}
