"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { ACTIVITY_TYPES, activities } from "@/db/schema";
import { usersExist } from "@/lib/activities";
import { created, updated } from "@/lib/audit";
import { firstError, formToObject, zDate, zIntOpt, zText } from "@/lib/forms";
import { type ActionResult, checkUser } from "@/lib/permissions";

const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES, { error: "Elegí el tipo" }),
  title: z.string({ error: "Escribí qué hay que hacer" }).min(1, "Escribí qué hay que hacer").max(200, "Máximo 200 caracteres"),
  notes: z.string().max(2000, "Máximo 2000 caracteres").optional(),
  dueDate: zDate,
  assignedTo: z.string({ error: "Elegí a quién se asigna" }).min(1, "Elegí a quién se asigna"),
  clientId: zIntOpt,
  leadId: zIntOpt,
  vehicleId: zIntOpt,
  supplierId: zIntOpt,
});

// La agenda aparece en el menú (contador), en Inicio y en las fichas vinculadas: se revalida todo.
const revalidate = () => revalidatePath("/", "layout");

export async function saveActivity(id: number | null, formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkUser();
  if (error) return error;
  const parsed = activitySchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  if (!(await usersExist([d.assignedTo]))) return { ok: false, error: "El usuario asignado no existe." };
  const values = {
    type: d.type,
    title: d.title,
    notes: d.notes ?? null,
    dueDate: d.dueDate,
    assignedTo: d.assignedTo,
    clientId: d.clientId ?? null,
    leadId: d.leadId ?? null,
    vehicleId: d.vehicleId ?? null,
    supplierId: d.supplierId ?? null,
  };
  if (id) await db.update(activities).set({ ...values, ...updated(user.id) }).where(eq(activities.id, id));
  else await db.insert(activities).values({ ...values, ...created(user.id) });
  revalidate();
  return { ok: true, message: id ? "Actividad actualizada" : "Actividad agendada" };
}

const doneSchema = z.object({
  doneNote: zText,
  // "Programar la siguiente": solo si se elige fecha.
  nextDate: zDate.optional(),
  nextTitle: z.string().max(200, "Máximo 200 caracteres").optional(),
  nextAssignedTo: z.string().optional(),
});

/**
 * Marca como hecha, con un comentario opcional del resultado, y opcionalmente agenda la siguiente
 * (mismo tipo y vínculo) en el mismo paso, como "Hecho y programar siguiente" en Odoo.
 */
export async function completeActivity(id: number, formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkUser();
  if (error) return error;
  const parsed = doneSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  if (d.nextAssignedTo && !(await usersExist([d.nextAssignedTo]))) {
    return { ok: false, error: "El usuario asignado no existe." };
  }
  const done = await db.transaction(async (tx) => {
    const [current] = await tx
      .update(activities)
      .set({ doneAt: new Date(), doneBy: user.id, doneNote: d.doneNote ?? null, ...updated(user.id) })
      .where(and(eq(activities.id, id), isNull(activities.doneAt)))
      .returning();
    if (current && d.nextDate) {
      await tx.insert(activities).values({
        type: current.type,
        title: d.nextTitle || current.title,
        dueDate: d.nextDate,
        assignedTo: d.nextAssignedTo || current.assignedTo,
        clientId: current.clientId,
        leadId: current.leadId,
        vehicleId: current.vehicleId,
        supplierId: current.supplierId,
        ...created(user.id),
      });
    }
    return current;
  });
  if (!done) return { ok: false, error: "La actividad no existe o ya estaba hecha." };
  revalidate();
  return { ok: true, message: d.nextDate ? "¡Hecha! Quedó agendada la siguiente." : "¡Hecha!" };
}

const rescheduleSchema = z.object({ dueDate: zDate });

/** Mueve una actividad pendiente a otra fecha (sin marcarla como hecha). */
export async function rescheduleActivity(id: number, formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkUser();
  if (error) return error;
  const parsed = rescheduleSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  await db
    .update(activities)
    .set({ dueDate: parsed.data.dueDate, ...updated(user.id) })
    .where(and(eq(activities.id, id), isNull(activities.doneAt)));
  revalidate();
  return { ok: true, message: "Actividad reprogramada" };
}

export async function reopenActivity(id: number): Promise<ActionResult> {
  const { user, error } = await checkUser();
  if (error) return error;
  await db
    .update(activities)
    .set({ doneAt: null, doneBy: null, doneNote: null, ...updated(user.id) })
    .where(eq(activities.id, id));
  revalidate();
  return { ok: true, message: "Actividad reabierta" };
}

export async function deleteActivity(id: number): Promise<ActionResult> {
  const { error } = await checkUser();
  if (error) return error;
  await db.delete(activities).where(eq(activities.id, id));
  revalidate();
  return { ok: true, message: "Actividad eliminada" };
}
