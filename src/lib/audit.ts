import "server-only";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";

// Auditoría (T-025): las acciones agregan estos campos al insertar / modificar.
export const created = (userId: string) => ({ createdBy: userId });
export const updated = (userId: string) => ({ updatedBy: userId, updatedAt: new Date() });

/** Usuarios activos (para "Asignada a" y para mostrar nombres), una vez por request. */
export const getUsers = cache(() =>
  db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(users)
    .where(eq(users.status, "active"))
    .orderBy(asc(users.name)),
);

/** id → nombre de todos los usuarios (incluye inactivos: pueden figurar en registros viejos). */
export const getUserNames = cache(async () => {
  const rows = await db.select({ id: users.id, name: users.name, username: users.username }).from(users);
  return new Map(rows.map((u) => [u.id, u.name ?? u.username ?? "—"]));
});
