import { describe, expect, it } from "vitest";
import { type ExpenseInput, resolveExpense } from "./expense-rules";

const base: ExpenseInput = {
  date: "2026-10-20",
  scope: "general",
  category: "generales",
  voucherType: "sin_comprobante",
  payment: "contado",
  amount: 1000,
};

describe("resolveExpense", () => {
  it("general contado sin proveedor: válido, ignora el vehículo", () => {
    const r = resolveExpense({ ...base, vehicleId: 3 });
    expect(r.ok && r.values).toMatchObject({ scope: "general", vehicleId: null, supplierId: null, paid: true });
  });

  it("alcance vehículo exige vehículo", () => {
    expect(resolveExpense({ ...base, scope: "vehiculo", category: "vehiculo" })).toEqual({
      ok: false,
      error: "Elegí el vehículo",
    });
    const r = resolveExpense({ ...base, scope: "vehiculo", category: "vehiculo", vehicleId: 3 });
    expect(r.ok && r.values.vehicleId).toBe(3);
  });

  it("a pagar exige proveedor", () => {
    expect(resolveExpense({ ...base, payment: "a_pagar" })).toEqual({
      ok: false,
      error: "Para dejarlo a pagar elegí un proveedor",
    });
    const r = resolveExpense({ ...base, payment: "a_pagar", supplierId: 9 });
    expect(r.ok && r.values).toMatchObject({ supplierId: 9, paid: false });
  });

  it("combustible exige proveedor y queda siempre contado", () => {
    expect(resolveExpense({ ...base, category: "combustible" }).ok).toBe(false);
    const r = resolveExpense({ ...base, category: "combustible", supplierId: 1, payment: "a_pagar" });
    expect(r.ok && r.values.paid).toBe(true);
  });

  it("sin comprobante descarta el número", () => {
    const r = resolveExpense({ ...base, voucherNumber: "0001-123" });
    expect(r.ok && r.values.voucherNumber).toBeNull();
    const f = resolveExpense({ ...base, voucherType: "factura_a", voucherNumber: "0001-123" });
    expect(f.ok && f.values.voucherNumber).toBe("0001-123");
  });
});
