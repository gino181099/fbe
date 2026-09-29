import "server-only";
import { and, count, desc, eq, gte, lte, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { collections, expenses, fuelLoads, routes, trips } from "@/db/schema";
import { sumOf } from "./balances";
import type { MonthTotal } from "./monthly";

/**
 * Totales por mes ("YYYY-MM") entre dos fechas (inclusive), opcionalmente de un cliente.
 * Costos directos = chofer + gasoil + adicionales de los recorridos (como /ventas).
 * Gastos generales = gastos sin categoría combustible (los pagos a estación pagan el gasoil ya contado) + cargas extras.
 * Una serie sin permiso (o gastos generales con cliente elegido) vuelve `null`.
 */
export async function getMonthlyTotals(
  from: string,
  to: string,
  { sales, finance }: { sales: boolean; finance: boolean },
  clientId?: number,
) {
  const tripMonth = sql<string>`to_char(${trips.date}, 'YYYY-MM')`;
  const collectionMonth = sql<string>`to_char(${collections.date}, 'YYYY-MM')`;
  const expenseMonth = sql<string>`to_char(${expenses.date}, 'YYYY-MM')`;
  const loadMonth = sql<string>`to_char(${fuelLoads.date}, 'YYYY-MM')`;
  const directCost = sql<number>`coalesce(sum(coalesce(${trips.driverPay}, 0) + coalesce(${trips.fuelPesos}, 0) + coalesce(${trips.extraPayments}, 0)), 0)`.mapWith(
    Number,
  );

  const tripWhere: SQL[] = [gte(trips.date, from), lte(trips.date, to)];
  if (clientId) tripWhere.push(eq(trips.clientId, clientId));
  const collectionWhere: SQL[] = [eq(collections.kind, "cobro"), gte(collections.date, from), lte(collections.date, to)];
  if (clientId) collectionWhere.push(eq(collections.clientId, clientId));
  const general = finance && !clientId;

  const [tripRows, collected, spent, loads] = await Promise.all([
    sales
      ? db
          .select({ month: tripMonth, billed: sumOf(trips.price), direct: directCost })
          .from(trips)
          .where(and(...tripWhere))
          .groupBy(tripMonth)
      : null,
    finance
      ? db
          .select({ month: collectionMonth, total: sumOf(collections.amount) })
          .from(collections)
          .where(and(...collectionWhere))
          .groupBy(collectionMonth)
      : null,
    general
      ? db
          .select({ month: expenseMonth, total: sumOf(expenses.amount) })
          .from(expenses)
          .where(and(ne(expenses.category, "combustible"), gte(expenses.date, from), lte(expenses.date, to)))
          .groupBy(expenseMonth)
      : null,
    general
      ? db
          .select({ month: loadMonth, total: sumOf(fuelLoads.pesos) })
          .from(fuelLoads)
          .where(and(gte(fuelLoads.date, from), lte(fuelLoads.date, to)))
          .groupBy(loadMonth)
      : null,
  ]);
  return {
    billed: tripRows?.map((r) => ({ month: r.month, total: r.billed })) ?? null,
    collected,
    directCosts: tripRows?.map((r) => ({ month: r.month, total: r.direct })) ?? null,
    generalExpenses: spent && loads ? [...spent, ...loads] : null,
  } satisfies Record<string, MonthTotal[] | null>;
}

/** Recorridos más vendidos entre dos fechas (opcionalmente de un cliente): por cantidad y, a igualdad, por facturado. */
export async function getTopRoutes(from: string, to: string, clientId?: number, limit = 10) {
  const name = sql<string | null>`coalesce(${routes.name}, ${trips.routeText})`;
  const total = sumOf(trips.price);
  const where: SQL[] = [gte(trips.date, from), lte(trips.date, to)];
  if (clientId) where.push(eq(trips.clientId, clientId));
  const rows = await db
    .select({ name, n: count(), total })
    .from(trips)
    .leftJoin(routes, eq(routes.id, trips.routeId))
    .where(and(...where))
    .groupBy(name)
    .orderBy(desc(count()), desc(total))
    .limit(limit);
  return rows.map((r) => ({ ...r, name: r.name ?? "Sin especificar" }));
}
