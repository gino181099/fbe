import { describe, expect, it } from "vitest";
import { buildMonthlySeries, formatMonth, lastMonths, totalsOf } from "./monthly";

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

describe("formatMonth", () => {
  it("formatea como 'mes año' abreviado", () => {
    expect(formatMonth("2026-09")).toBe("sep 2026");
    expect(formatMonth("2025-01")).toBe("ene 2025");
    expect(formatMonth("2025-12")).toBe("dic 2025");
  });
});

describe("buildMonthlySeries", () => {
  const months = ["2025-12", "2026-01", "2026-02"];

  it("rellena con ceros los meses sin datos y calcula el margen", () => {
    const rows = buildMonthlySeries(months, {
      billed: [
        { month: "2025-12", total: 1000 },
        { month: "2026-02", total: 500 },
      ],
      collected: [{ month: "2026-01", total: 300 }],
      expenses: [{ month: "2026-02", total: 800 }],
    });
    expect(rows).toEqual([
      { month: "2025-12", billed: 1000, collected: 0, expenses: 0, margin: 1000 },
      { month: "2026-01", billed: 0, collected: 300, expenses: 0, margin: 0 },
      { month: "2026-02", billed: 500, collected: 0, expenses: 800, margin: -300 },
    ]);
  });

  it("una serie sin permiso queda en null y el margen también", () => {
    const rows = buildMonthlySeries(months, {
      billed: [{ month: "2026-01", total: 100 }],
      collected: null,
      expenses: null,
    });
    expect(rows[1]).toEqual({ month: "2026-01", billed: 100, collected: null, expenses: null, margin: null });
    expect(rows[0].billed).toBe(0);
  });

  it("ignora meses fuera de la lista", () => {
    const rows = buildMonthlySeries(months, {
      billed: [{ month: "2025-11", total: 999 }],
      collected: null,
      expenses: [],
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
      expenses: [{ month: "2026-02", total: 200 }],
    });
    expect(totalsOf(rows)).toEqual({ billed: 150, collected: null, expenses: 200, margin: -50 });
  });
});
