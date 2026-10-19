import "server-only";
import { type AnyColumn, type SQL, and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenses, fuelLoads, supplierPayments, suppliers, trips } from "@/db/schema";
import { sumOf } from "./balances";
import { balanceFromTotals, buildSupplierStatement } from "./supplier-ledger";

const sumWhere = (col: AnyColumn, cond: SQL) =>
  sql<number>`coalesce(sum(${col}) filter (where ${cond}), 0)`.mapWith(Number);

// Las estaciones se vinculan por nombre (sin FK): mismo criterio en listado y detalle.
const nameKey = (col: AnyColumn) => sql<string>`lower(trim(${col}))`;

/** Saldo (debe − haber, sin fechas) de cada proveedor, por id. */
export async function getSupplierBalances() {
  const [list, exp, pays, tripFuel, loads] = await Promise.all([
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers),
    db
      .select({
        id: expenses.supplierId,
        owed: sumWhere(expenses.amount, sql`${expenses.category} <> 'combustible' and not ${expenses.paid}`),
        fuel: sumWhere(expenses.amount, sql`${expenses.category} = 'combustible'`),
      })
      .from(expenses)
      .where(isNotNull(expenses.supplierId))
      .groupBy(expenses.supplierId),
    db
      .select({ id: supplierPayments.supplierId, total: sumOf(supplierPayments.amount) })
      .from(supplierPayments)
      .groupBy(supplierPayments.supplierId),
    db
      .select({ key: nameKey(trips.fuelSupplier), total: sumOf(trips.fuelPesos) })
      .from(trips)
      .where(isNotNull(trips.fuelSupplier))
      .groupBy(nameKey(trips.fuelSupplier)),
    db
      .select({ key: nameKey(fuelLoads.supplier), total: sumOf(fuelLoads.pesos) })
      .from(fuelLoads)
      .where(isNotNull(fuelLoads.supplier))
      .groupBy(nameKey(fuelLoads.supplier)),
  ]);
  const expBy = new Map(exp.map((e) => [e.id, e]));
  const payBy = new Map(pays.map((p) => [p.id, p.total]));
  const tripBy = new Map(tripFuel.map((t) => [t.key, t.total]));
  const loadBy = new Map(loads.map((l) => [l.key, l.total]));
  return new Map(
    list.map((s) => {
      const key = s.name.trim().toLowerCase();
      const balance = balanceFromTotals({
        owed: expBy.get(s.id)?.owed ?? 0,
        fuelExpenses: expBy.get(s.id)?.fuel ?? 0,
        payments: payBy.get(s.id) ?? 0,
        tripFuel: tripBy.get(key) ?? 0,
        fuelLoads: loadBy.get(key) ?? 0,
      });
      return [s.id, balance];
    }),
  );
}

/** Proveedor con su estado de cuenta (desde/hasta opcionales) y sus pagos (para editar/borrar). */
export async function getSupplierStatement(id: number, from?: string, to?: string) {
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
  if (!supplier) return null;
  const key = supplier.name.trim().toLowerCase();
  const [exp, payments, tripFuel, loads] = await Promise.all([
    db
      .select({
        id: expenses.id,
        date: expenses.date,
        category: expenses.category,
        concept: expenses.concept,
        notes: expenses.notes,
        amount: expenses.amount,
        paid: expenses.paid,
      })
      .from(expenses)
      .where(eq(expenses.supplierId, id)),
    db
      .select()
      .from(supplierPayments)
      .where(eq(supplierPayments.supplierId, id))
      .orderBy(desc(supplierPayments.date), desc(supplierPayments.id)),
    db
      .select({ date: trips.date, amount: sumOf(trips.fuelPesos), count: count() })
      .from(trips)
      .where(and(sql`${nameKey(trips.fuelSupplier)} = ${key}`, isNotNull(trips.fuelPesos)))
      .groupBy(trips.date)
      .orderBy(asc(trips.date)),
    db
      .select({ id: fuelLoads.id, date: fuelLoads.date, amount: fuelLoads.pesos, liters: fuelLoads.liters, notes: fuelLoads.notes })
      .from(fuelLoads)
      .where(sql`${nameKey(fuelLoads.supplier)} = ${key}`),
  ]);
  const statement = buildSupplierStatement({ expenses: exp, payments, tripFuel, fuelLoads: loads }, from, to);
  return { supplier, payments, ...statement };
}
