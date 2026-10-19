import { describe, expect, it } from "vitest";
import { type MonthTotals, lastDayOfMonth, planHistoricAdjustments } from "./statement";

describe("lastDayOfMonth", () => {
  it("calcula el último día, incluidos bisiestos", () => {
    expect(lastDayOfMonth("2025-02")).toBe("2025-02-28");
    expect(lastDayOfMonth("2024-02")).toBe("2024-02-29");
    expect(lastDayOfMonth("2026-08")).toBe("2026-08-31");
    expect(lastDayOfMonth("2025-12")).toBe("2025-12-31");
  });
});

describe("planHistoricAdjustments", () => {
  const m = (t: Partial<MonthTotals>): MonthTotals => ({
    billed: 0,
    collected: 0,
    manualAdjusted: 0,
    scriptAdjusted: 0,
    ...t,
  });

  it("decide insertar, actualizar, borrar o sin cambios, ordenado por mes", () => {
    const plan = planHistoricAdjustments(
      new Map([
        ["2025-03", m({ billed: 1000.004, collected: 200, manualAdjusted: 100 })],
        ["2025-01", m({ billed: 500, scriptAdjusted: 500 })],
        ["2025-02", m({ billed: 800, scriptAdjusted: 500 })],
        ["2025-04", m({ billed: 100, collected: 150, scriptAdjusted: 20 })],
        ["2025-05", m({ billed: 100, collected: 100 })],
      ]),
    );
    expect(plan.map((p) => [p.period, p.target, p.action])).toEqual([
      ["2025-01", 500, "sin cambios"],
      ["2025-02", 800, "actualizar"],
      ["2025-03", 700, "insertar"],
      ["2025-04", 0, "borrar"],
      ["2025-05", 0, "sin cambios"],
    ]);
  });
});
