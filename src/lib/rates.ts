import "server-only";
import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { documentItems, documents, rates, receiptTrips, receipts, routes, trips } from "@/db/schema";
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
export async function applyNewRates(
  clientId: number,
  validFrom: string,
  items: NewRate[],
  recalculate: boolean,
  userId: string,
) {
  const current = await ratesInForce(clientId, validFrom);
  const plan = planRateChanges(current, validFrom, items);
  if (!plan.updatePrice.length && !plan.close.length && !plan.insert.length && !recalculate) return;
  await db.transaction(async (tx) => {
    for (const u of plan.updatePrice) await tx.update(rates).set({ price: u.price }).where(eq(rates.id, u.id));
    for (const c of plan.close) await tx.update(rates).set({ validTo: c.validTo }).where(eq(rates.id, c.id));
    if (plan.insert.length) await tx.insert(rates).values(plan.insert.map((r) => ({ clientId, ...r, createdBy: userId })));
    if (recalculate) await recalculateTripPrices(clientId, validFrom, tx);
  });
}

type Executor = Pick<typeof db, "execute">;

/**
 * Reasigna tarifa y precio a los recorridos del cliente desde una fecha. No toca los que están en un
 * comprobante factura/interno o recibo vigente (su precio quedó documentado).
 */
export function recalculateTripPrices(clientId: number, from: string, exec: Executor = db) {
  return exec.execute(sql`
    UPDATE ${trips} t SET rate_id = r.id, price = r.price
    FROM ${rates} r
    WHERE t.client_id = ${clientId} AND t.date >= ${from}
      AND r.client_id = t.client_id AND r.route_id = t.route_id AND r.capacity = t.capacity
      AND r.valid_from <= t.date AND (r.valid_to IS NULL OR t.date <= r.valid_to)
      AND NOT EXISTS (
        SELECT 1 FROM ${documentItems} di JOIN ${documents} d ON d.id = di.document_id
        WHERE di.trip_id = t.id AND d.voided_at IS NULL AND d.type IN ('factura', 'interno')
      )
      AND NOT EXISTS (
        SELECT 1 FROM ${receiptTrips} rt JOIN ${receipts} rc ON rc.id = rt.receipt_id
        WHERE rt.trip_id = t.id AND rc.voided_at IS NULL
      )
  `);
}
