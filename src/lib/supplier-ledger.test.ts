import { describe, expect, it } from "vitest";
import {
  type SupplierExpense,
  type SupplierLedgerInput,
  balanceFromTotals,
  buildSupplierStatement,
  supplierBalance,
} from "./supplier-ledger";

const empty: SupplierLedgerInput = { expenses: [], payments: [], tripFuel: [], fuelLoads: [] };
const expense = (e: Partial<SupplierExpense>): SupplierExpense => ({
  id: 1,
  date: "2026-10-20",
  category: "generales",
  concept: "Service",
  notes: null,
  amount: 1000,
  paid: false,
  ...e,
});

describe("buildSupplierStatement", () => {
  it("sin movimientos: todo en cero", () => {
    const s = buildSupplierStatement(empty);
    expect(s).toEqual({ opening: 0, lines: [], totalDebit: 0, totalCredit: 0, closing: 0 });
    expect(supplierBalance(empty)).toBe(0);
  });

  it("gasto contado: se muestra pero no mueve el saldo", () => {
    const s = buildSupplierStatement({ ...empty, expenses: [expense({ paid: true, amount: 5000 })] });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({ kind: "gasto_contado", info: true, debit: 0, credit: 0, amount: 5000, balance: 0 });
    expect(s.closing).toBe(0);
  });

  it("gasto a pagar suma al debe y los pagos lo bajan, con saldo corrido", () => {
    const s = buildSupplierStatement({
      ...empty,
      expenses: [expense({ id: 1, date: "2026-10-20", amount: 10000 }), expense({ id: 2, date: "2026-10-22", amount: 2500.5 })],
      payments: [{ id: 7, date: "2026-10-21", amount: 4000, method: "Transferencia", notes: null }],
    });
    expect(s.lines.map((l) => [l.kind, l.balance])).toEqual([
      ["gasto", 10000],
      ["pago", 6000],
      ["gasto", 8500.5],
    ]);
    expect(s.lines[1].description).toBe("Transferencia");
    expect(s.totalDebit).toBe(12500.5);
    expect(s.totalCredit).toBe(4000);
    expect(s.closing).toBe(8500.5);
  });

  it("estación: gasoil agrupado por día, cargas extras al debe y gastos combustible al haber", () => {
    const input: SupplierLedgerInput = {
      expenses: [expense({ id: 3, date: "2026-10-25", category: "combustible", amount: 30000, paid: true })],
      payments: [{ id: 1, date: "2026-10-25", amount: 5000, method: null, notes: null }],
      tripFuel: [
        { date: "2026-10-20", amount: 10000 },
        { date: "2026-10-20", amount: 15000 },
        { date: "2026-10-21", amount: 8000, count: 2 },
        { date: "2026-10-22", amount: 0 },
      ],
      fuelLoads: [{ id: 9, date: "2026-10-21", amount: 2000, liters: 20, notes: null }],
    };
    const s = buildSupplierStatement(input);
    expect(s.lines.map((l) => [l.kind, l.description, l.debit, l.credit])).toEqual([
      ["gasoil", "Gasoil recorridos (2)", 25000, 0],
      ["gasoil", "Gasoil recorridos (2)", 8000, 0],
      ["carga", "20 L", 2000, 0],
      ["pago_combustible", "Service", 0, 30000],
      ["pago", "Pago", 0, 5000],
    ]);
    expect(s.closing).toBe(0);
    expect(supplierBalance(input)).toBe(0);
    // Totales agregados (listado) dan lo mismo que el detalle.
    expect(balanceFromTotals({ owed: 0, tripFuel: 33000, fuelLoads: 2000, payments: 5000, fuelExpenses: 30000 })).toBe(0);
  });

  it("con desde/hasta: lo anterior va al saldo anterior y lo posterior se ignora", () => {
    const input: SupplierLedgerInput = {
      ...empty,
      expenses: [
        expense({ id: 1, date: "2026-09-01", amount: 1000 }),
        expense({ id: 2, date: "2026-10-05", amount: 300 }),
        expense({ id: 3, date: "2026-11-05", amount: 999 }),
      ],
      payments: [{ id: 1, date: "2026-09-15", amount: 400, method: null, notes: null }],
    };
    const s = buildSupplierStatement(input, "2026-10-01", "2026-10-31");
    expect(s.opening).toBe(600);
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].balance).toBe(900);
    expect(s.closing).toBe(900);
    // El saldo total (sin fechas) incluye todo.
    expect(supplierBalance(input)).toBe(1899);
  });

  it("con desde pero sin líneas en el período: el cierre es el saldo anterior", () => {
    const s = buildSupplierStatement({ ...empty, expenses: [expense({ date: "2026-01-01", amount: 700 })] }, "2026-10-01");
    expect(s.opening).toBe(700);
    expect(s.lines).toEqual([]);
    expect(s.closing).toBe(700);
  });
});
