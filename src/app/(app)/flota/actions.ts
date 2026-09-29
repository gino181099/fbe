"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { drivers, vehicles } from "@/db/schema";
import { normalizePlate } from "@/lib/constants";
import { firstError, formToObject, zText } from "@/lib/forms";
import { type ActionResult, checkPermission } from "@/lib/permissions";

const IN_USE = "Tiene movimientos asociados: desactivalo en lugar de borrarlo";

function pgCode(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
}

// ON DELETE RESTRICT dispara 23001 (restrict_violation); NO ACTION, 23503 (foreign_key_violation).
const isInUse = (e: unknown) => ["23001", "23503"].includes(pgCode(e) ?? "");

function revalidate() {
  revalidatePath("/flota");
  revalidatePath("/ventas");
  revalidatePath("/finanzas", "layout");
}

/* ──────────────────────────────── Choferes ─────────────────────────────── */

const driverSchema = z.object({
  name: z.string({ error: "El nombre es obligatorio" }).min(1, "El nombre es obligatorio").max(200, "El nombre es demasiado largo"),
  phone: zText,
  notes: zText,
});

export async function saveDriver(id: number | null, formData: FormData): Promise<ActionResult> {
  const { error } = await checkPermission("ventas");
  if (error) return error;
  const parsed = driverSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const values = { name: parsed.data.name, phone: parsed.data.phone ?? null, notes: parsed.data.notes ?? null };
  if (id) await db.update(drivers).set(values).where(eq(drivers.id, id));
  else await db.insert(drivers).values(values);
  revalidate();
  return { ok: true, message: "Chofer guardado" };
}

export async function toggleDriver(id: number, active: boolean): Promise<ActionResult> {
  const { error } = await checkPermission("ventas");
  if (error) return error;
  await db.update(drivers).set({ active }).where(eq(drivers.id, id));
  revalidate();
  return { ok: true, message: active ? "Chofer activado" : "Chofer desactivado" };
}

export async function deleteDriver(id: number): Promise<ActionResult> {
  const { error } = await checkPermission("ventas");
  if (error) return error;
  try {
    await db.delete(drivers).where(eq(drivers.id, id));
  } catch (e) {
    if (isInUse(e)) return { ok: false, error: IN_USE };
    throw e;
  }
  revalidate();
  return { ok: true, message: "Chofer eliminado" };
}

/* ─────────────────────────────── Vehículos ─────────────────────────────── */

const vehicleSchema = z.object({
  plate: z
    .string({ error: "La patente es obligatoria" })
    .transform(normalizePlate)
    .pipe(z.string().min(1, "La patente es obligatoria").max(20, "La patente es demasiado larga")),
  model: z.string({ error: "El modelo es obligatorio" }).min(1, "El modelo es obligatorio").max(200, "El modelo es demasiado largo"),
  seats: z.coerce
    .number({ error: "Plazas inválidas" })
    .int({ error: "Plazas inválidas" })
    .min(1, "Plazas inválidas")
    .max(60, "Plazas inválidas"),
  notes: zText,
});

export async function saveVehicle(id: number | null, formData: FormData): Promise<ActionResult> {
  const { error } = await checkPermission("ventas");
  if (error) return error;
  const parsed = vehicleSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const values = { ...parsed.data, notes: parsed.data.notes ?? null };
  try {
    if (id) await db.update(vehicles).set(values).where(eq(vehicles.id, id));
    else await db.insert(vehicles).values(values);
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: false, error: "Ya existe un vehículo con esa patente" };
    throw e;
  }
  revalidate();
  return { ok: true, message: "Vehículo guardado" };
}

export async function toggleVehicle(id: number, active: boolean): Promise<ActionResult> {
  const { error } = await checkPermission("ventas");
  if (error) return error;
  await db.update(vehicles).set({ active }).where(eq(vehicles.id, id));
  revalidate();
  return { ok: true, message: active ? "Vehículo activado" : "Vehículo desactivado" };
}

export async function deleteVehicle(id: number): Promise<ActionResult> {
  const { error } = await checkPermission("ventas");
  if (error) return error;
  try {
    await db.delete(vehicles).where(eq(vehicles.id, id));
  } catch (e) {
    if (isInUse(e)) return { ok: false, error: IN_USE };
    throw e;
  }
  revalidate();
  return { ok: true, message: "Vehículo eliminado" };
}
