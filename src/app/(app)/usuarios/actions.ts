"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { LEVELS, MODULES, permissions, users } from "@/db/schema";
import { type ActionResult, checkPermission } from "@/lib/permissions";

const level = z.enum(LEVELS);
const schema = z.object({
  status: z.enum(["pending", "active", "disabled"]),
  contactos: level,
  leads: level,
  ventas: level,
  finanzas: level,
  usuarios: level,
} satisfies Record<(typeof MODULES)[number] | "status", z.ZodType>);

async function editableTarget(userId: string) {
  const [target] = await db.select().from(users).where(eq(users.id, userId));
  if (!target) return { error: "Usuario inexistente" };
  if (target.isAdmin) return { error: "Los permisos del administrador no se pueden modificar." };
  return { target };
}

export async function updateUserAccess(userId: string, formData: FormData): Promise<ActionResult> {
  const { error, user } = await checkPermission("usuarios");
  if (error) return error;
  if (user.id === userId) return { ok: false, error: "No podés modificar tus propios permisos." };
  const check = await editableTarget(userId);
  if (check.error) return { ok: false, error: check.error };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const data = parsed.data;

  await db.transaction(async (tx) => {
    await tx.update(users).set({ status: data.status }).where(eq(users.id, userId));
    await tx
      .insert(permissions)
      .values(MODULES.map((module) => ({ userId, module, level: data[module] })))
      .onConflictDoUpdate({
        target: [permissions.userId, permissions.module],
        // En un upsert múltiple cada fila toma su propio valor nuevo.
        set: { level: sql`excluded.level` },
      });
  });
  revalidatePath("/usuarios");
  return { ok: true, message: "Permisos guardados" };
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const { error, user } = await checkPermission("usuarios");
  if (error) return error;
  if (user.id === userId) return { ok: false, error: "No podés eliminar tu propio usuario." };
  const check = await editableTarget(userId);
  if (check.error) return { ok: false, error: check.error };
  await db.delete(users).where(eq(users.id, userId));
  revalidatePath("/usuarios");
  return { ok: true, message: "Usuario eliminado" };
}
