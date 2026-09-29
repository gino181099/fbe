import "server-only";
import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { rates, routes, trips } from "@/db/schema";
import { type NewRate, planRateChanges } from "./rates-plan";

/** Tarifa vigente de un cliente para un recorrido + categoría en una fecha. */
export async function findRate(clientId: number, routeId: number, capacity: number, date: string) {
  const [rate] = await db
    .select()
    .from(rates)
    .where(
      and(
        eq(rates.clientId, clientId),
        eq(rates.routeId, routeId),
        eq(rates.capacity, capacity),
        lte(rates.validFrom, date),
        or(isNull(rates.validTo), gte(rates.validTo, date)),
      ),
    )
    .orderBy(sql`${rates.validFrom} desc`)
    .limit(1);
  return rate ?? null;
}

/** Tarifas vigentes de un cliente en una fecha. */
export async function ratesInForce(clientId: number, date: string) {
  return db
    .select({
      id: rates.id,
      routeId: rates.routeId,
      routeName: routes.name,
      capacity: rates.capacity,
      price: rates.price,
      validFrom: rates.validFrom,
      validTo: rates.validTo,
    })
    .from(rates)
    .innerJoin(routes, eq(routes.id, rates.routeId))
    .where(
      and(eq(rates.clientId, clientId), lte(rates.validFrom, date), or(isNull(rates.validTo), gte(rates.validTo, date))),
    )
    .orderBy(routes.name, rates.capacity);
}

export type { NewRate };

/**
 * Carga una nueva versión de tarifas a partir de `validFrom`.
 * Para cada recorrido + categoría: la tarifa vigente se cierra el día anterior
 * (o se reemplaza si empezaba ese mismo día) y se crea la nueva (ver `planRateChanges`).
 * Con `recalculate`, los recorridos ya cargados desde esa fecha toman el precio nuevo.
 */
export async function applyNewRates(clientId: number, validFrom: string, items: NewRate[], recalculate: boolean) {
  const current = await ratesInForce(clientId, validFrom);
  const plan = planRateChanges(current, validFrom, items);
  const queries: unknown[] = [
    ...plan.updatePrice.map((u) => db.update(rates).set({ price: u.price }).where(eq(rates.id, u.id))),
    ...plan.close.map((c) => db.update(rates).set({ validTo: c.validTo }).where(eq(rates.id, c.id))),
    ...plan.insert.map((r) => db.insert(rates).values({ clientId, ...r })),
  ];
  if (recalculate) queries.push(recalculateTripPrices(clientId, validFrom));
  if (queries.length === 0) return;
  // db.batch corre todo en una transacción.
  await db.batch(queries as unknown as Parameters<typeof db.batch>[0]);
}

/** Reasigna tarifa y precio a los recorridos del cliente desde una fecha. */
export function recalculateTripPrices(clientId: number, from: string) {
  return db.execute(sql`
    UPDATE ${trips} t SET rate_id = r.id, price = r.price
    FROM ${rates} r
    WHERE t.client_id = ${clientId} AND t.date >= ${from}
      AND r.client_id = t.client_id AND r.route_id = t.route_id AND r.capacity = t.capacity
      AND r.valid_from <= t.date AND (r.valid_to IS NULL OR t.date <= r.valid_to)
  `);
}
