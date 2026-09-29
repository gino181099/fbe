import "server-only";
import { type AnyColumn, and, count, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, collections, routes, trips } from "@/db/schema";
import { type StatementLine, buildStatement } from "./statement";

export const sumOf = (col: AnyColumn) => sql<number>`coalesce(sum(${col}), 0)`.mapWith(Number);

/** Suma de montos filtrada por tipo (cobro / ajuste). */
const sumOfKind = (kind: "cobro" | "ajuste") =>
  sql<number>`coalesce(sum(${collections.amount}) filter (where ${collections.kind} = ${kind}), 0)`.mapWith(Number);

type Balance = { billed: number; collected: number; adjusted: number; balance: number; trips: number };

/** Facturado (recorridos), cobrado (solo cobros), ajustes y saldo por cliente. */
export async function getBalances() {
  const [billed, collected] = await Promise.all([
    db
      .select({ clientId: trips.clientId, total: sumOf(trips.price), trips: count() })
      .from(trips)
      .groupBy(trips.clientId),
    db
      .select({ clientId: collections.clientId, cobros: sumOfKind("cobro"), ajustes: sumOfKind("ajuste") })
      .from(collections)
      .groupBy(collections.clientId),
  ]);
  const map = new Map<number, Balance>();
  for (const b of billed)
    map.set(b.clientId, { billed: b.total, collected: 0, adjusted: 0, balance: b.total, trips: b.trips });
  for (const c of collected) {
    const entry = map.get(c.clientId) ?? { billed: 0, collected: 0, adjusted: 0, balance: 0, trips: 0 };
    entry.collected = c.cobros;
    entry.adjusted = c.ajustes;
    entry.balance = entry.billed - c.cobros - c.ajustes;
    map.set(c.clientId, entry);
  }
  return map;
}

export type { StatementLine };

/** Estado de cuenta de un cliente entre dos fechas (inclusive). */
export async function getStatement(clientId: number, from: string, to: string) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) return null;

  const [[prevBilled], [prevCollected], tripRows, collectionRows] = await Promise.all([
    db.select({ v: sumOf(trips.price) }).from(trips).where(and(eq(trips.clientId, clientId), lt(trips.date, from))),
    db
      .select({ v: sumOf(collections.amount) })
      .from(collections)
      .where(and(eq(collections.clientId, clientId), lt(collections.date, from))),
    db
      .select({
        id: trips.id,
        date: trips.date,
        route: routes.name,
        routeText: trips.routeText,
        passengers: trips.passengers,
        capacity: trips.capacity,
        price: trips.price,
      })
      .from(trips)
      .leftJoin(routes, eq(routes.id, trips.routeId))
      .where(and(eq(trips.clientId, clientId), gte(trips.date, from), lte(trips.date, to)))
      .orderBy(trips.date, trips.id),
    db
      .select()
      .from(collections)
      .where(and(eq(collections.clientId, clientId), gte(collections.date, from), lte(collections.date, to)))
      .orderBy(collections.date, collections.id),
  ]);

  // El saldo anterior descuenta cobros y ajustes.
  const opening = prevBilled.v - prevCollected.v;
  return { client, from, to, ...buildStatement(opening, tripRows, collectionRows) };
}
