import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db";
import { type Level, type Module, MODULES, permissions, users } from "@/db/schema";

const RANK: Record<Level, number> = { none: 0, view: 1, edit: 2 };

export type CurrentUser = Awaited<ReturnType<typeof loadCurrentUser>>;

async function loadCurrentUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) return null;
  const rows = await db.select().from(permissions).where(eq(permissions.userId, id));
  const perms = Object.fromEntries(
    MODULES.map((m) => [m, user.isAdmin ? "edit" : (rows.find((r) => r.module === m)?.level ?? "none")]),
  ) as Record<Module, Level>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return { ...safe, permissions: perms };
}

/** Usuario logueado leído de la base (una vez por request). */
export const getCurrentUser = cache(loadCurrentUser);

export function can(user: NonNullable<CurrentUser>, module: Module, level: Level = "view") {
  if (user.status !== "active") return false;
  return RANK[user.permissions[module]] >= RANK[level];
}

/** Para páginas: exige usuario activo o redirige. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "active") redirect("/pendiente");
  return user;
}

/** Para páginas: exige permiso sobre un módulo o redirige a /sin-acceso. */
export async function requirePermission(module: Module, level: Level = "view") {
  const user = await requireUser();
  if (!can(user, module, level)) redirect("/sin-acceso");
  return user;
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/** Para server actions: devuelve el usuario o un error serializable. */
export async function checkPermission(module: Module, level: Level = "edit") {
  const user = await getCurrentUser();
  if (!user || !can(user, module, level)) {
    return { user: null, error: { ok: false, error: "No tenés permiso para realizar esta acción." } as const };
  }
  return { user, error: null };
}
