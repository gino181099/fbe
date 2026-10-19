// Cuenta corriente con proveedores (T-021): lógica pura (sin base) para poder testearla.
//
// Debe  = gastos "a pagar" (paid=false, no combustible) + gasoil de recorridos (por día) + cargas extras.
// Haber = pagos a proveedor (supplier_payment) + gastos de categoría combustible (pagos a estación).
// Los gastos contado (paid=true, no combustible) se muestran como informativos y no mueven el saldo.

export type SupplierExpense = {
  id: number;
  date: string;
  category: string;
  concept: string | null;
  notes: string | null;
  amount: number;
  paid: boolean;
};
export type SupplierPaymentRow = { id: number; date: string; amount: number; method: string | null; notes: string | null };
/** Gasoil de recorridos: puede venir ya agrupado por día (`count` = cantidad de recorridos). */
export type SupplierTripFuel = { date: string; amount: number; count?: number };
export type SupplierFuelLoad = { id: number; date: string; amount: number; liters: number | null; notes: string | null };

export type SupplierLedgerInput = {
  expenses: SupplierExpense[];
  payments: SupplierPaymentRow[];
  tripFuel: SupplierTripFuel[];
  fuelLoads: SupplierFuelLoad[];
};

export const SUPPLIER_MOVEMENT_KINDS = ["gasto", "gasto_contado", "gasoil", "carga", "pago", "pago_combustible"] as const;
export type SupplierMovementKind = (typeof SUPPLIER_MOVEMENT_KINDS)[number];
export const SUPPLIER_MOVEMENT_LABELS: Record<SupplierMovementKind, string> = {
  gasto: "Gasto a pagar",
  gasto_contado: "Gasto contado",
  gasoil: "Gasoil recorridos",
  carga: "Carga extra",
  pago: "Pago",
  pago_combustible: "Pago (gasto combustible)",
};

export type SupplierLine = {
  kind: SupplierMovementKind;
  date: string;
  description: string;
  debit: number;
  credit: number;
  /** Saldo corrido después de la línea (debe − haber). */
  balance: number;
  /** Informativa: no mueve el saldo (gasto contado); su importe va en `amount`. */
  info: boolean;
  /** Importe original del movimiento. */
  amount: number;
  /** id del gasto / pago / carga de origen (para editar o borrar). */
  refId?: number;
};
type Movement = Omit<SupplierLine, "balance">;

const round2 = (n: number) => Math.round(n * 100) / 100;
// Mismo día: primero los cargos, después los pagos.
const KIND_ORDER: Record<SupplierMovementKind, number> = {
  gasto: 0,
  gasto_contado: 1,
  gasoil: 2,
  carga: 3,
  pago_combustible: 4,
  pago: 5,
};

/** Todos los movimientos del proveedor, ordenados, sin saldo. */
export function supplierMovements(input: SupplierLedgerInput): Movement[] {
  const lines: Movement[] = [];
  const add = (m: Omit<Movement, "debit" | "credit" | "info"> & Partial<Movement>) =>
    lines.push({ debit: 0, credit: 0, info: false, ...m });

  for (const e of input.expenses) {
    const description = [e.concept, e.notes].filter(Boolean).join(" · ") || "Gasto";
    const base = { date: e.date, description, amount: e.amount, refId: e.id };
    if (e.category === "combustible") add({ ...base, kind: "pago_combustible", credit: e.amount });
    else if (!e.paid) add({ ...base, kind: "gasto", debit: e.amount });
    else add({ ...base, kind: "gasto_contado", info: true });
  }
  // Gasoil de recorridos: una línea por día.
  const byDay = new Map<string, { amount: number; count: number }>();
  for (const t of input.tripFuel) {
    if (!t.amount) continue;
    const d = byDay.get(t.date) ?? { amount: 0, count: 0 };
    d.amount += t.amount;
    d.count += t.count ?? 1;
    byDay.set(t.date, d);
  }
  for (const [date, d] of byDay) {
    const amount = round2(d.amount);
    add({ kind: "gasoil", date, description: `Gasoil recorridos (${d.count})`, debit: amount, amount });
  }
  for (const l of input.fuelLoads) {
    const description = [l.liters ? `${l.liters} L` : null, l.notes].filter(Boolean).join(" · ") || "Carga extra";
    add({ kind: "carga", date: l.date, description, debit: l.amount, amount: l.amount, refId: l.id });
  }
  for (const p of input.payments) {
    const description = [p.method, p.notes].filter(Boolean).join(" · ") || "Pago";
    add({ kind: "pago", date: p.date, description, credit: p.amount, amount: p.amount, refId: p.id });
  }
  return lines.sort(
    (a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.refId ?? 0) - (b.refId ?? 0),
  );
}

/** Saldo total (debe − haber) sin filtro de fechas. */
export function supplierBalance(input: SupplierLedgerInput) {
  return round2(supplierMovements(input).reduce((s, l) => s + l.debit - l.credit, 0));
}

/** Totales ya agregados por proveedor (listado): misma regla que `supplierBalance`. */
export type SupplierTotals = {
  /** Gastos a pagar (paid=false) que no son combustible. */
  owed: number;
  tripFuel: number;
  fuelLoads: number;
  payments: number;
  /** Gastos de categoría combustible (pagos a estación). */
  fuelExpenses: number;
};
export function balanceFromTotals(t: SupplierTotals) {
  return round2(t.owed + t.tripFuel + t.fuelLoads - t.payments - t.fuelExpenses);
}

/**
 * Estado de cuenta del proveedor entre `from` y `to` (ambos opcionales, inclusive): lo anterior a `from`
 * va al saldo anterior; lo posterior a `to` se ignora.
 */
export function buildSupplierStatement(input: SupplierLedgerInput, from?: string, to?: string) {
  const movements = supplierMovements(input).filter((m) => !to || m.date <= to);
  const before = movements.filter((m) => from && m.date < from);
  const inRange = movements.filter((m) => !from || m.date >= from);
  const opening = round2(before.reduce((s, m) => s + m.debit - m.credit, 0));
  let balance = opening;
  const lines: SupplierLine[] = inRange.map((m) => {
    balance = round2(balance + m.debit - m.credit);
    return { ...m, balance };
  });
  const totalDebit = round2(inRange.reduce((s, m) => s + m.debit, 0));
  const totalCredit = round2(inRange.reduce((s, m) => s + m.credit, 0));
  return { opening, lines, totalDebit, totalCredit, closing: round2(opening + totalDebit - totalCredit) };
}
