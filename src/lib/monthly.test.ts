import { describe, expect, it } from "vitest";
import { buildMonthlySeries, formatMonth, lastMonths, monthsBetween, resolveRange, totalsOf } from "./monthly";

describe("lastMonths", () => {
  it("devuelve 12 meses incluido el actual, del más viejo al más nuevo", () => {
    const months = lastMonths("2026-09-28");
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-10");
    expect(months[11]).toBe("2026-09");
  });

  it("cruza el año de diciembre a enero", () => {
    expect(lastMonths("2026-02-10", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(lastMonths("2026-01-01")[0]).toBe("2025-02");
    expect(lastMonths("2025-12-31", 2)).toEqual(["2025-11", "2025-12"]);
  });
});

describe("monthsBetween", () => {
  it("incluye ambos extremos y cruza el año", () => {
    expect(monthsBetween("2025-11-15", "2026-02-03")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthsBetween("2026-03", "2026-03")).toEqual(["2026-03"]);
  });

  it("devuelve vacío si desde es posterior", () => {
    expect(monthsBetween("2026-05-01", "2026-04-30")).toEqual([]);
  });
});

describe("resolveRange", () => {
  const hoy = "2026-09-28";

  it("sin parámetros: 1ro del mes de hace 11 meses hasta hoy", () => {
    const r = resolveRange(undefined, undefined, hoy);
    expect(r.from).toBe("2025-10-01");
    expect(r.to).toBe(hoy);
    expect(r.months).toHaveLength(12);
  });

  it("ignora fechas inválidas y usa el default", () => {
    expect(resolveRange("2026-02-31", "hola", hoy)).toMatchObject({ from: "2025-10-01", to: hoy });
    expect(resolveRange("26-01-01", "2026-13-01", hoy)).toMatchObject({ from: "2025-10-01", to: hoy });
  });

  it("respeta un rango válido con meses de borde", () => {
    const r = resolveRange("2026-01-10", "2026-03-05", hoy);
    expect(r).toEqual({ from: "2026-01-10", to: "2026-03-05", months: ["2026-01", "2026-02", "2026-03"] });
  });

  it("intercambia desde y hasta si vienen al revés", () => {
    const r = resolveRange("2025-03-10", "2025-01-01", hoy);
    expect(r.from).toBe("2025-01-01");
    expect(r.to).toBe("2025-03-10");
    expect(r.months).toEqual(["2025-01", "2025-02", "2025-03"]);
  });

  it("limita el rango a 36 meses recortando desde", () => {
    const r = resolveRange("2020-01-01", undefined, hoy);
    expect(r.months).toHaveLength(36);
    expect(r.from).toBe("2023-10-01");
    expect(r.months[35]).toBe("2026-09");
  });

  it("solo hasta: 12 meses que terminan en hasta", () => {
    expect(resolveRange(undefined, "2025-06-30", hoy)).toMatchObject({ from: "2024-07-01", to: "2025-06-30" });
  });
});

describe("formatMonth", () => {
  it("formatea como 'mes año' abreviado", () => {
    expect(formatMonth("2026-09")).toBe("sep 2026");
    expect(formatMonth("2025-01")).toBe("ene 2025");
    expect(formatMonth("2025-12")).toBe("dic 2025");
  });
});

describe("buildMonthlySeries", () => {
  const months = ["2025-12", "2026-01", "2026-02"];

  it("rellena con ceros, suma costos directos y generales en gastos y calcula el margen", () => {
    const rows = buildMonthlySeries(months, {
      billed: [
        { month: "2025-12", total: 1000 },
        { month: "2026-02", total: 500 },
      ],
      collected: [{ month: "2026-01", total: 300 }],
      directCosts: [{ month: "2026-02", total: 600 }],
      // Gastos generales llegan en dos consultas (expense + fuel_load): los meses repetidos se suman.
      generalExpenses: [
        { month: "2026-02", total: 150 },
        { month: "2026-02", total: 50 },
        { month: "2025-12", total: 100 },
      ],
    });
    expect(rows).toEqual([
      { month: "2025-12", billed: 1000, collected: 0, directCosts: 0, generalExpenses: 100, expenses: 100, margin: 900 },
      { month: "2026-01", billed: 0, collected: 300, directCosts: 0, generalExpenses: 0, expenses: 0, margin: 0 },
      { month: "2026-02", billed: 500, collected: 0, directCosts: 600, generalExpenses: 200, expenses: 800, margin: -300 },
    ]);
  });

  it("sin finanzas: gastos = costos directos y cobrado/generales quedan en null", () => {
    const rows = buildMonthlySeries(months, {
      billed: [{ month: "2026-01", total: 100 }],
      collected: null,
      directCosts: [{ month: "2026-01", total: 40 }],
      generalExpenses: null,
    });
    expect(rows[1]).toEqual({
      month: "2026-01",
      billed: 100,
      collected: null,
      directCosts: 40,
      generalExpenses: null,
      expenses: 40,
      margin: 60,
    });
  });

  it("sin ventas: gastos = generales y el margen queda en null", () => {
    const rows = buildMonthlySeries(months, {
      billed: null,
      collected: [],
      directCosts: null,
      generalExpenses: [{ month: "2026-01", total: 70 }],
    });
    expect(rows[1]).toMatchObject({ billed: null, directCosts: null, generalExpenses: 70, expenses: 70, margin: null });
  });

  it("sin ninguna serie de gastos, gastos y margen quedan en null", () => {
    const rows = buildMonthlySeries(months, {
      billed: [{ month: "2026-01", total: 100 }],
      collected: null,
      directCosts: null,
      generalExpenses: null,
    });
    expect(rows[1]).toMatchObject({ billed: 100, expenses: null, margin: null });
  });

  it("ignora meses fuera de la lista", () => {
    const rows = buildMonthlySeries(months, {
      billed: [{ month: "2025-11", total: 999 }],
      collected: null,
      directCosts: [],
      generalExpenses: null,
    });
    expect(rows.every((r) => r.billed === 0 && r.margin === 0)).toBe(true);
  });
});

describe("totalsOf", () => {
  it("suma cada serie visible y deja null las ocultas", () => {
    const rows = buildMonthlySeries(["2026-01", "2026-02"], {
      billed: [
        { month: "2026-01", total: 100 },
        { month: "2026-02", total: 50 },
      ],
      collected: null,
      directCosts: [{ month: "2026-02", total: 120 }],
      generalExpenses: [{ month: "2026-01", total: 80 }],
    });
    expect(totalsOf(rows)).toEqual({
      billed: 150,
      collected: null,
      directCosts: 120,
      generalExpenses: 80,
      expenses: 200,
      margin: -50,
    });
  });
});
