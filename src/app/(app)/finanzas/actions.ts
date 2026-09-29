"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { COLLECTION_KINDS, collections, EXPENSE_CATEGORIES, expenses, fuelLoads } from "@/db/schema";
import { firstError, formToObject, zDate, zIntOpt, zMoney, zMoneyOpt, zText } from "@/lib/forms";
import { type ActionResult, checkPermission } from "@/lib/permissions";

function revalidate() {
  revalidatePath("/finanzas", "layout");
  revalidatePath("/contactos", "layout");
  revalidatePath("/flota");
  revalidatePath("/");
}

/* ───────────────────────────────── Cobros ──────────────────────────────── */

const collectionSchema = z.object({
  date: zDate,
  clientId: z.coerce.number({ error: "Elegí un cliente" }).int().positive({ error: "Elegí un cliente" }),
  amount: zMoney.refine((n) => n !== 0, "El monto no puede ser 0"),
  kind: z.enum(COLLECTION_KINDS, { error: "Tipo inválido" }).default("cobro"),
  method: zText,
  notes: zText,
});

export async function saveCollection(id: number | null, formData: FormData): Promise<ActionResult> {
  const { error } = await checkPermission("finanzas");
  if (error) return error;
  const parsed = collectionSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const values = { ...parsed.data, method: parsed.data.method ?? null, notes: parsed.data.notes ?? null };
  if (id) await db.update(collections).set(values).where(eq(collections.id, id));
  else await db.insert(collections).values(values);
  revalidate();
  const label = parsed.data.kind === "ajuste" ? "Ajuste" : "Cobro";
  return { ok: true, message: `${label} ${id ? "actualizado" : "registrado"}` };
}

export async function deleteCollection(id: number): Promise<ActionResult> {
  const { error } = await checkPermission("finanzas");
  if (error) return error;
  await db.delete(collections).where(eq(collections.id, id));
  revalidate();
  return { ok: true, message: "Movimiento eliminado" };
}

/* ───────────────────────────────── Gastos ──────────────────────────────── */

const expenseSchema = z.object({
  date: zDate,
  category: z.enum(EXPENSE_CATEGORIES),
  concept: zText,
  supplier: zText,
  amount: zMoney,
  notes: zText,
  vehicleId: zIntOpt,
  driverId: zIntOpt,
});

export async function saveExpense(id: number | null, formData: FormData): Promise<ActionResult> {
  const { error } = await checkPermission("finanzas");
  if (error) return error;
  const parsed = expenseSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const values = {
    ...parsed.data,
    concept: parsed.data.concept ?? null,
    supplier: parsed.data.supplier ?? null,
    notes: parsed.data.notes ?? null,
    vehicleId: parsed.data.vehicleId ?? null,
    driverId: parsed.data.driverId ?? null,
  };
  if (id) await db.update(expenses).set(values).where(eq(expenses.id, id));
  else await db.insert(expenses).values(values);
  revalidate();
  return { ok: true, message: id ? "Gasto actualizado" : "Gasto registrado" };
}

export async function deleteExpense(id: number): Promise<ActionResult> {
  const { error } = await checkPermission("finanzas");
  if (error) return error;
  await db.delete(expenses).where(eq(expenses.id, id));
  revalidate();
  return { ok: true, message: "Gasto eliminado" };
}

/* ───────────────────────── Cargas de combustible ───────────────────────── */

const fuelSchema = z.object({
  date: zDate,
  pesos: zMoney,
  liters: zMoneyOpt,
  supplier: zText,
  notes: zText,
});

export async function saveFuelLoad(id: number | null, formData: FormData): Promise<ActionResult> {
  const { error } = await checkPermission("finanzas");
  if (error) return error;
  const parsed = fuelSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const values = {
    ...parsed.data,
    liters: parsed.data.liters ?? null,
    supplier: parsed.data.supplier ?? null,
    notes: parsed.data.notes ?? null,
  };
  if (id) await db.update(fuelLoads).set(values).where(eq(fuelLoads.id, id));
  else await db.insert(fuelLoads).values(values);
  revalidate();
  return { ok: true, message: id ? "Carga actualizada" : "Carga registrada" };
}

export async function deleteFuelLoad(id: number): Promise<ActionResult> {
  const { error } = await checkPermission("finanzas");
  if (error) return error;
  await db.delete(fuelLoads).where(eq(fuelLoads.id, id));
  revalidate();
  return { ok: true, message: "Carga eliminada" };
}
