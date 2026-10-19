"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { clients, DEFAULT_FUEL_SUPPLIER, trips } from "@/db/schema";
import { firstError, formToObject, zDate, zIntOpt, zMoneyOpt, zText } from "@/lib/forms";
import { type ActionResult, checkPermission } from "@/lib/permissions";
import { findRate, ratesInForce } from "@/lib/rates";

function pgCode(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code ?? err?.cause?.code;
}

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
  revalidatePath("/");
}

export async function createTrip(formData: FormData): Promise<ActionResult> {
  const { error } = await checkPermission("ventas");
  if (error) return error;
  const built = await buildTrip(formData);
  if ("error" in built) return { ok: false, error: built.error! };
  await db.insert(trips).values(built.values);
  revalidate();
  return { ok: true, message: "Recorrido cargado" };
}

export async function updateTrip(id: number, formData: FormData): Promise<ActionResult> {
  const { error } = await checkPermission("ventas");
  if (error) return error;
  const built = await buildTrip(formData);
  if ("error" in built) return { ok: false, error: built.error! };
  await db.update(trips).set(built.values).where(eq(trips.id, id));
  revalidate();
  return { ok: true, message: "Recorrido actualizado" };
}

export async function deleteTrip(id: number): Promise<ActionResult> {
  const { error } = await checkPermission("ventas");
  if (error) return error;
  try {
    await db.delete(trips).where(eq(trips.id, id));
  } catch (e) {
    if (isInUse(e)) return { ok: false, error: "No se puede eliminar: el recorrido está en un comprobante" };
    throw e;
  }
  revalidate();
  return { ok: true, message: "Recorrido eliminado" };
}
