import { describe, expect, it } from "vitest";
import { type RateInForce, planRateChanges } from "./rates-plan";

const rate = (r: Partial<RateInForce> & Pick<RateInForce, "id">): RateInForce => ({
  routeId: 1,
  capacity: 14,
  validFrom: "2025-01-01",
  validTo: null,
  ...r,
});

describe("planRateChanges", () => {
  it("sin tarifa vigente solo da de alta la nueva, abierta", () => {
    const plan = planRateChanges([], "2025-06-01", [{ routeId: 1, capacity: 14, price: 100000 }]);
    expect(plan).toEqual({
      updatePrice: [],
      close: [],
      insert: [{ routeId: 1, capacity: 14, price: 100000, validFrom: "2025-06-01", validTo: null }],
    });
  });

  it("cierra la vigente el día anterior y la nueva hereda su validTo (null)", () => {
    const plan = planRateChanges([rate({ id: 7 })], "2025-03-01", [{ routeId: 1, capacity: 14, price: 120000 }]);
    expect(plan.updatePrice).toEqual([]);
    expect(plan.close).toEqual([{ id: 7, validTo: "2025-02-28" }]);
    expect(plan.insert).toEqual([
      { routeId: 1, capacity: 14, price: 120000, validFrom: "2025-03-01", validTo: null },
    ]);
  });

  it("la nueva hereda el validTo con fecha de la vieja", () => {
    const plan = planRateChanges([rate({ id: 7, validTo: "2025-12-31" })], "2025-06-01", [
      { routeId: 1, capacity: 14, price: 130000 },
    ]);
    expect(plan.close).toEqual([{ id: 7, validTo: "2025-05-31" }]);
    expect(plan.insert[0].validTo).toBe("2025-12-31");
  });

  it("si la vigente empieza el mismo día solo actualiza el precio", () => {
    const plan = planRateChanges([rate({ id: 9, validFrom: "2025-06-01" })], "2025-06-01", [
      { routeId: 1, capacity: 14, price: 90000 },
    ]);
    expect(plan).toEqual({ updatePrice: [{ id: 9, price: 90000 }], close: [], insert: [] });
  });

  it("matchea por recorrido y capacidad", () => {
    const current = [rate({ id: 1, routeId: 1, capacity: 14 }), rate({ id: 2, routeId: 1, capacity: 18 })];
    const plan = planRateChanges(current, "2025-06-01", [{ routeId: 1, capacity: 18, price: 200000 }]);
    expect(plan.close).toEqual([{ id: 2, validTo: "2025-05-31" }]);
    expect(plan.insert).toHaveLength(1);
    expect(plan.insert[0]).toMatchObject({ routeId: 1, capacity: 18 });
  });

  it("otro recorrido con la misma capacidad no se cierra", () => {
    const plan = planRateChanges([rate({ id: 3, routeId: 2 })], "2025-06-01", [
      { routeId: 1, capacity: 14, price: 50000 },
    ]);
    expect(plan.close).toEqual([]);
    expect(plan.insert).toHaveLength(1);
  });

  it("lista vacía devuelve plan vacío", () => {
    expect(planRateChanges([rate({ id: 1 })], "2025-06-01", [])).toEqual({
      updatePrice: [],
      close: [],
      insert: [],
    });
  });
});
