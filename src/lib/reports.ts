import "server-only";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { collections, expenses, routes, trips } from "@/db/schema";
import { sumOf } from "./balances";
import type { MonthTotal } from "./monthly";

/** Totales por mes ("YYYY-MM") entre dos fechas (inclusive). Una serie sin permiso vuelve `null`. */
export async function getMonthlyTotals(from: string, to: string, { sales, finance }: { sales: boolean; finance: boolean }) {
  const tripMonth = sql<string>`to_char(${trips.date}, 'YYYY-MM')`;
  const collectionMonth = sql<string>`to_char(${collections.date}, 'YYYY-MM')`;
  const expenseMonth = sql<string>`to_char(${expenses.date}, 'YYYY-MM')`;

  const [billed, collected, spent] = await Promise.all([
    sales
      ? db
          .select({ month: tripMonth, total: sumOf(trips.price) })
          .from(trips)
          .where(and(gte(trips.date, from), lte(trips.date, to)))
          .groupBy(tripMonth)
      : null,
    finance
      ? db
          .select({ month: collectionMonth, total: sumOf(collections.amount) })
          .from(collections)
          .where(and(eq(collections.kind, "cobro"), gte(collections.date, from), lte(collections.date, to)))
          .groupBy(collectionMonth)
      : null,
    finance
      ? db
          .select({ month: expenseMonth, total: sumOf(expenses.amount) })
          .from(expenses)
          .where(and(gte(expenses.date, from), lte(expenses.date, to)))
          .groupBy(expenseMonth)
      : null,
  ]);
  return { billed, collected, expenses: spent } satisfies Record<string, MonthTotal[] | null>;
}

/** Recorridos más vendidos entre dos fechas: por cantidad y, a igualdad, por facturado. */
export async function getTopRoutes(from: string, to: string, limit = 10) {
  const name = sql<string | null>`coalesce(${routes.name}, ${trips.routeText})`;
  const total = sumOf(trips.price);
  const rows = await db
    .select({ name, n: count(), total })
    .from(trips)
    .leftJoin(routes, eq(routes.id, trips.routeId))
    .where(and(gte(trips.date, from), lte(trips.date, to)))
    .groupBy(name)
    .orderBy(desc(count()), desc(total))
    .limit(limit);
  return rows.map((r) => ({ ...r, name: r.name ?? "Sin especificar" }));
}
