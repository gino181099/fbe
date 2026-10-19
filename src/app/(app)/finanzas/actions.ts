"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { EXPENSE_CATEGORIES, EXPENSE_SCOPES, expenses, fuelLoads, supplierPayments, suppliers, VOUCHER_TYPES } from "@/db/schema";
import { isInUse, isUniqueViolation } from "@/lib/db-errors";
import { resolveExpense } from "@/lib/expense-rules";
import { firstError, formToObject, zDate, zIntOpt, zMoney, zMoneyOpt, zText } from "@/lib/forms";
import { type ActionResult, checkPermission } from "@/lib/permissions";

function revalidate() {
  revalidatePath("/finanzas", "layout");
  revalidatePath("/contactos", "layout");
  revalidatePath("/flota");
  revalidatePath("/");
}

// Cobros: solo historial desde T-019 (los pagos nuevos son recibos, `recibos/actions.ts`).

/* ───────────────────────────────── Gastos ──────────────────────────────── */

const expenseSchema = z.object({
  date: zDate,
  scope: z.enum(EXPENSE_SCOPES, { error: "Elegí el alcance" }).default("general"),
  category: z.enum(EXPENSE_CATEGORIES, { error: "Elegí la categoría" }),
  subcategory: z.string().max(100, "La subcategoría es demasiado larga").optional(),
  concept: zText,
  purpose: zText,
  supplierId: zIntOpt,
  voucherType: z.enum(VOUCHER_TYPES, { error: "Tipo de comprobante inválido" }).default("sin_comprobante"),
  voucherNumber: z.string().max(50, "El número de comprobante es demasiado largo").optional(),
  payment: z.enum(["contado", "a_pagar"], { error: "Indicá si es contado o a pagar" }).default("contado"),
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
  const r = resolveExpense(parsed.data);
  if (!r.ok) return r;
  const { values } = r;
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

/* ─────────────────────────────── Proveedores ───────────────────────────── */

const supplierSchema = z.object({
  name: z.string({ error: "El nombre es obligatorio" }).min(1, "El nombre es obligatorio").max(200, "El nombre es demasiado largo"),
  cuit: z.string().max(20, "CUIT inválido").optional(),
  invoices: z.enum(["si", "no"], { error: "Indicá si emite factura" }).default("si"),
  category: z.string().max(100, "El rubro es demasiado largo").optional(),
  notes: zText,
});

export async function saveSupplier(id: number | null, formData: FormData): Promise<ActionResult> {
  const { error } = await checkPermission("finanzas");
  if (error) return error;
  const parsed = supplierSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const values = {
    // formToObject ya recorta los extremos; además se unifican los espacios internos.
    name: parsed.data.name.replace(/\s+/g, " "),
    cuit: parsed.data.cuit ?? null,
    invoices: parsed.data.invoices === "si",
    category: parsed.data.category ?? null,
    notes: parsed.data.notes ?? null,
  };
  try {
    if (id) await db.update(suppliers).set(values).where(eq(suppliers.id, id));
    else await db.insert(suppliers).values(values);
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "Ya existe un proveedor con ese nombre" };
    throw e;
  }
  revalidate();
  return { ok: true, message: id ? "Proveedor actualizado" : "Proveedor creado" };
}

export async function toggleSupplier(id: number, active: boolean): Promise<ActionResult> {
  const { error } = await checkPermission("finanzas");
  if (error) return error;
  await db.update(suppliers).set({ active }).where(eq(suppliers.id, id));
  revalidate();
  return { ok: true, message: active ? "Proveedor activado" : "Proveedor desactivado" };
}

export async function deleteSupplier(id: number): Promise<ActionResult> {
  const { error } = await checkPermission("finanzas");
  if (error) return error;
  try {
    await db.delete(suppliers).where(eq(suppliers.id, id));
  } catch (e) {
    if (isInUse(e)) return { ok: false, error: "No se puede eliminar: tiene gastos o pagos; desactivalo" };
    throw e;
  }
  revalidate();
  return { ok: true, message: "Proveedor eliminado" };
}

const supplierPaymentSchema = z.object({
  date: zDate,
  amount: zMoney.refine((n) => n > 0, "El monto debe ser mayor a cero"),
  method: z.string().max(100, "El medio de pago es demasiado largo").optional(),
  notes: zText,
});

export async function saveSupplierPayment(supplierId: number, id: number | null, formData: FormData): Promise<ActionResult> {
  const { error } = await checkPermission("finanzas");
  if (error) return error;
  const parsed = supplierPaymentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const values = { ...parsed.data, method: parsed.data.method ?? null, notes: parsed.data.notes ?? null };
  if (id)
    await db
      .update(supplierPayments)
      .set(values)
      .where(and(eq(supplierPayments.id, id), eq(supplierPayments.supplierId, supplierId)));
  else await db.insert(supplierPayments).values({ ...values, supplierId });
  revalidate();
  return { ok: true, message: id ? "Pago actualizado" : "Pago registrado" };
}

export async function deleteSupplierPayment(id: number): Promise<ActionResult> {
  const { error } = await checkPermission("finanzas");
  if (error) return error;
  await db.delete(supplierPayments).where(eq(supplierPayments.id, id));
  revalidate();
  return { ok: true, message: "Pago eliminado" };
}
