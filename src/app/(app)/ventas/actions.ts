"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clients, DEFAULT_FUEL_SUPPLIER, receiptTrips, receipts, trips } from "@/db/schema";
import { created, updated } from "@/lib/audit";
import { CC_START } from "@/lib/constants";
import { isUniqueViolation, pgCode } from "@/lib/db-errors";
import { formatReceiptNumber } from "@/lib/doc-number";
import { formatDate, formatMoney, today } from "@/lib/format";
import { tripsInActiveDocument } from "@/lib/documents";
import { firstError, formToObject, zDate, zIntOpt, zMoneyOpt, zText } from "@/lib/forms";
import { type ActionResult, checkPermission } from "@/lib/permissions";
import { findRate, ratesInForce } from "@/lib/rates";
import { nextReceiptNumber, tripsInActiveReceipt } from "@/lib/receipts";

// ON DELETE RESTRICT dispara 23001 (restrict_violation); NO ACTION, 23503 (foreign_key_violation).
const isInUse = (e: unknown) => ["23001", "23503"].includes(pgCode(e) ?? "");

/** Tarifas vigentes de un cliente en una fecha (para armar el formulario). */
export async function getClientRates(clientId: number, date: string) {
  const { error } = await checkPermission("ventas", "view");
  if (error || !Number.isInteger(clientId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  return ratesInForce(clientId, date);
}

const tripSchema = z.object({
  date: zDate,
  clientId: z.coerce.number({ error: "Elegí un cliente" }).int().positive({ error: "Elegí un cliente" }),
  routeId: zIntOpt,
  routeText: zText,
  passengers: zIntOpt,
  capacity: zIntOpt,
  price: zMoneyOpt,
  // Texto histórico (hidden): solo se conserva si no se elige un chofer.
  driver: zText,
  driverId: zIntOpt,
  vehicleId: zIntOpt,
  driverPay: zMoneyOpt,
  fuelPesos: zMoneyOpt,
  fuelLiters: zMoneyOpt,
  fuelSupplier: zText,
  extraPayments: zMoneyOpt,
  notes: zText,
});

async function buildTrip(formData: FormData) {
  const parsed = tripSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) } as const;
  const d = parsed.data;

  const [client] = await db.select({ type: clients.type }).from(clients).where(eq(clients.id, d.clientId));
  if (!client) return { error: "Cliente inexistente" } as const;
  if (client.type === "potencial") {
    return { error: "Es un cliente potencial: marcalo como ganado antes de cargarle recorridos." } as const;
  }

  // Para clientes recurrentes se busca la tarifa vigente en la fecha del viaje.
  const rate =
    d.routeId && d.capacity ? await findRate(d.clientId, d.routeId, d.capacity, d.date) : null;
  const price = d.price ?? rate?.price;
  if (price === undefined) {
    return {
      error:
        client.type === "recurrente"
          ? "No hay tarifa vigente para ese recorrido y capacidad en esa fecha. Cargá el precio a mano o actualizá el tarifario."
          : "Ingresá el precio del servicio.",
    } as const;
  }
  if (!d.routeId && !d.routeText) return { error: "Indicá el recorrido." } as const;

  return {
    values: {
      date: d.date,
      clientId: d.clientId,
      routeId: d.routeId ?? null,
      routeText: d.routeId ? null : (d.routeText ?? null),
      passengers: d.passengers ?? null,
      capacity: d.capacity ?? null,
      rateId: rate?.id ?? null,
      price,
      // El vehículo es solo un dato: no interviene en capacidad, tarifa ni precio.
      driverId: d.driverId ?? null,
      vehicleId: d.vehicleId ?? null,
      driver: d.driverId ? null : (d.driver ?? null),
      driverPay: d.driverPay ?? null,
      fuelPesos: d.fuelPesos ?? null,
      fuelLiters: d.fuelLiters ?? null,
      fuelSupplier: d.fuelSupplier ?? (d.fuelPesos ? DEFAULT_FUEL_SUPPLIER : null),
      extraPayments: d.extraPayments ?? null,
      notes: d.notes ?? null,
    },
  } as const;
}

function revalidate() {
  revalidatePath("/ventas");
  revalidatePath("/flota");
  revalidatePath("/finanzas", "layout");
  revalidatePath("/contactos", "layout");
  revalidatePath("/");
}

// Cobro al cargar el recorrido (solo en el alta): genera un recibo X imputado a ese recorrido.
const paymentSchema = z.object({
  payment: z.enum(["", "total", "parcial"]).catch(""),
  paidAmount: zMoneyOpt,
  paidMethod: z.string().trim().max(100, "Medio de pago: máximo 100 caracteres").optional(),
});

export async function createTrip(formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkPermission("ventas");
  if (error) return error;
  const built = await buildTrip(formData);
  if ("error" in built) return { ok: false, error: built.error! };
  const pay = paymentSchema.safeParse(formToObject(formData));
  if (!pay.success) return { ok: false, error: firstError(pay.error) };
  const { payment, paidAmount, paidMethod } = pay.data;
  const price = built.values.price;

  let amount = 0;
  if (payment) {
    if (built.values.date < CC_START)
      return { ok: false, error: `Solo se registra el pago de recorridos desde el ${formatDate(CC_START)}.` };
    amount = payment === "total" ? price : Math.round((paidAmount ?? 0) * 100) / 100;
    if (!(amount > 0)) return { ok: false, error: "Ingresá el monto que pagó el cliente." };
    if (payment === "parcial" && amount >= price)
      return { ok: false, error: `El pago parcial debe ser menor al precio (${formatMoney(price)}). Si pagó todo, marcá "El cliente ya pagó".` };
  }

  let receiptNumber: number | undefined;
  for (let attempt = 0; ; attempt++) {
    receiptNumber = payment ? await nextReceiptNumber() : undefined;
    try {
      await db.transaction(async (tx) => {
        const [{ id: tripId }] = await tx
          .insert(trips)
          .values({ ...built.values, ...created(user.id) })
          .returning({ id: trips.id });
        if (receiptNumber === undefined) return;
        const [{ id: receiptId }] = await tx
          .insert(receipts)
          .values({
            number: receiptNumber,
            date: today(),
            clientId: built.values.clientId,
            amount,
            method: paidMethod || null,
            notes: "Cargado desde Ventas al registrar el recorrido.",
            ...created(user.id),
          })
          .returning({ id: receipts.id });
        await tx.insert(receiptTrips).values({ receiptId, tripId, amount });
      });
      break;
    } catch (e) {
      // Otro alta tomó el mismo número de recibo: se reintenta una vez con el siguiente.
      if (receiptNumber !== undefined && isUniqueViolation(e) && attempt === 0) continue;
      throw e;
    }
  }
  revalidate();
  if (receiptNumber === undefined) return { ok: true, message: "Recorrido cargado" };
  return { ok: true, message: `Recorrido cargado con el recibo ${formatReceiptNumber(receiptNumber)}` };
}

export async function updateTrip(id: number, formData: FormData): Promise<ActionResult> {
  const { user, error } = await checkPermission("ventas");
  if (error) return error;
  const built = await buildTrip(formData);
  if ("error" in built) return { ok: false, error: built.error! };
  // Un recorrido en factura/interno o recibo vigente no cambia precio, cliente ni fecha (se anula primero).
  const [[current], inDocument, inReceipt] = await Promise.all([
    db.select({ price: trips.price, clientId: trips.clientId, date: trips.date }).from(trips).where(eq(trips.id, id)),
    tripsInActiveDocument([id]),
    tripsInActiveReceipt([id]),
  ]);
  if (!current) return { ok: false, error: "El recorrido no existe." };
  const lockedBy = inDocument.get(id)?.label ?? inReceipt.get(id);
  if (
    lockedBy &&
    (current.price !== built.values.price ||
      current.clientId !== built.values.clientId ||
      current.date !== built.values.date)
  ) {
    return { ok: false, error: `Está en ${lockedBy}.` };
  }
  await db.update(trips).set({ ...built.values, ...updated(user.id) }).where(eq(trips.id, id));
  revalidate();
  return { ok: true, message: "Recorrido actualizado" };
}

export async function deleteTrip(id: number): Promise<ActionResult> {
  const { error } = await checkPermission("ventas");
  if (error) return error;
  try {
    await db.delete(trips).where(eq(trips.id, id));
  } catch (e) {
    if (isInUse(e)) return { ok: false, error: "No se puede eliminar: el recorrido está en un comprobante o recibo" };
    throw e;
  }
  revalidate();
  return { ok: true, message: "Recorrido eliminado" };
}
