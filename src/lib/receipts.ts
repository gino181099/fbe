import "server-only";
import { type SQL, and, desc, eq, gte, inArray, isNotNull, isNull, lte, max } from "drizzle-orm";
import { db } from "@/db";
import { clients, receiptTrips, receipts, routes, trips } from "@/db/schema";
import { getClientLedger } from "./balances";
import { formatReceiptNumber } from "./doc-number";
import { pendingTripAmounts, tripDescription } from "./ledger";

export type ReceiptFilters = {
  clientId?: number;
  from?: string;
  to?: string;
  /** vigentes (por defecto) | anulados | todos */
  status?: "vigentes" | "anulados" | "todos";
};

/** Recibos con su cliente, más nuevos primero. */
export async function listReceipts(f: ReceiptFilters, limit = 500) {
  const where: SQL[] = [];
  if (f.clientId) where.push(eq(receipts.clientId, f.clientId));
  if (f.from) where.push(gte(receipts.date, f.from));
  if (f.to) where.push(lte(receipts.date, f.to));
  const status = f.status ?? "vigentes";
  if (status === "vigentes") where.push(isNull(receipts.voidedAt));
  if (status === "anulados") where.push(isNotNull(receipts.voidedAt));
  return db
    .select({ r: receipts, clientName: clients.name })
    .from(receipts)
    .innerJoin(clients, eq(clients.id, receipts.clientId))
    .where(and(...where))
    .orderBy(desc(receipts.date), desc(receipts.number))
    .limit(limit);
}

/** Recibo con cliente y recorridos tildados (null si no existe). */
export async function getReceipt(id: number) {
  const [row] = await db
    .select({ r: receipts, client: clients })
    .from(receipts)
    .innerJoin(clients, eq(clients.id, receipts.clientId))
    .where(eq(receipts.id, id));
  if (!row) return null;
  const tripRows = await db
    .select({
      id: receiptTrips.id,
      tripId: receiptTrips.tripId,
      amount: receiptTrips.amount,
      date: trips.date,
      price: trips.price,
      route: routes.name,
      routeText: trips.routeText,
      passengers: trips.passengers,
      capacity: trips.capacity,
    })
    .from(receiptTrips)
    .innerJoin(trips, eq(trips.id, receiptTrips.tripId))
    .leftJoin(routes, eq(routes.id, trips.routeId))
    .where(eq(receiptTrips.receiptId, id))
    .orderBy(trips.date, trips.id);
  return {
    ...row.r,
    client: row.client,
    trips: tripRows.map((t) => ({ ...t, description: tripDescription(t) })),
  };
}

/** Próximo número de recibo: máximo (incluye anulados, nunca se reutiliza) + 1. */
export async function nextReceiptNumber() {
  const [row] = await db.select({ n: max(receipts.number) }).from(receipts);
  return (row?.n ?? 0) + 1;
}

/**
 * Saldo actual del cliente y sus recorridos desde el corte con pendiente (según el ledger, con todos los
 * créditos aplicados). null si el cliente no existe.
 */
export async function getPendingTrips(clientId: number) {
  const data = await getClientLedger(clientId);
  if (!data) return null;
  const { ledger } = data;
  const pending = pendingTripAmounts(ledger);
  return {
    client: data.client,
    balance: ledger.balance,
    pending,
    trips: ledger.debits
      .filter((d) => d.tripId != null && pending.has(d.tripId))
      .map((d) => ({
        tripId: d.tripId!,
        date: d.date,
        description: d.description,
        amount: d.amount,
        remaining: d.remaining,
      })),
  };
}

/** Recorridos (de los pedidos) tildados en un recibo vigente: tripId → "el recibo X 0001-…: anulalo primero". */
export async function tripsInActiveReceipt(tripIds: number[]) {
  const map = new Map<number, string>();
  if (tripIds.length === 0) return map;
  const rows = await db
    .select({ tripId: receiptTrips.tripId, number: receipts.number })
    .from(receiptTrips)
    .innerJoin(receipts, eq(receipts.id, receiptTrips.receiptId))
    .where(and(inArray(receiptTrips.tripId, tripIds), isNull(receipts.voidedAt)));
  for (const r of rows) map.set(r.tripId, `el recibo ${formatReceiptNumber(r.number)}: anulalo primero`);
  return map;
}
