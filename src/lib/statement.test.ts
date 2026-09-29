import { describe, expect, it } from "vitest";
import {
  type MonthTotals,
  type StatementCollectionRow,
  type StatementTripRow,
  buildStatement,
  lastDayOfMonth,
  planHistoricAdjustments,
} from "./statement";

const trip = (t: Partial<StatementTripRow>): StatementTripRow => ({
  date: "2025-05-01",
  route: "Alta Montaña",
  routeText: null,
  passengers: null,
  capacity: null,
  price: 0,
  ...t,
});

const cobro = (c: Partial<StatementCollectionRow>): StatementCollectionRow => ({
  date: "2025-05-01",
  kind: "cobro",
  method: null,
  notes: null,
  amount: 0,
  ...c,
});

describe("buildStatement", () => {
  it("parte del saldo anterior (facturado previo − cobrado previo)", () => {
    const prevBilled = 500000;
    const prevCollected = 200000;
    const s = buildStatement(prevBilled - prevCollected, [], []);
    expect(s).toEqual({
      opening: 300000,
      lines: [],
      totalDebit: 0,
      totalCredit: 0,
      totalCollected: 0,
      closing: 300000,
    });
  });

  it("ordena por fecha, recorridos antes que cobros en el mismo día, con saldo corrido", () => {
    const s = buildStatement(
      1000,
      [trip({ date: "2025-05-03", price: 300 }), trip({ date: "2025-05-01", price: 500 })],
      [cobro({ date: "2025-05-01", amount: 200 }), cobro({ date: "2025-05-02", amount: 100 })],
    );
    expect(s.lines.map((l) => [l.date, l.kind, l.debit, l.credit, l.balance])).toEqual([
      ["2025-05-01", "recorrido", 500, 0, 1500],
      ["2025-05-01", "cobro", 0, 200, 1300],
      ["2025-05-02", "cobro", 0, 100, 1200],
      ["2025-05-03", "recorrido", 300, 0, 1500],
    ]);
    expect(s.totalDebit).toBe(800);
    expect(s.totalCredit).toBe(300);
    expect(s.closing).toBe(1500);
  });

  it("un cobro negativo (ajuste) aumenta el saldo", () => {
    const s = buildStatement(0, [trip({ price: 1000 })], [cobro({ date: "2025-05-02", amount: -250 })]);
    expect(s.lines[1].balance).toBe(1250);
    expect(s.totalCredit).toBe(-250);
    expect(s.closing).toBe(1250);
  });

  it("describe recorridos con ruta, plazas y pasajeros, con fallbacks", () => {
    const s = buildStatement(
      0,
      [
        trip({ date: "2025-05-01", route: "Ruta", capacity: 14, passengers: 15 }),
        trip({ date: "2025-05-02", route: null, routeText: "Traslado aeropuerto" }),
        trip({ date: "2025-05-03", route: null, routeText: null }),
      ],
      [],
    );
    expect(s.lines.map((l) => l.description)).toEqual([
      "Ruta (14 plazas) · 15 pax",
      "Traslado aeropuerto",
      "Recorrido",
    ]);
  });

  it("describe cobros con método y nota", () => {
    const s = buildStatement(
      0,
      [],
      [
        cobro({ date: "2025-05-01", method: "transferencia", notes: "factura 12" }),
        cobro({ date: "2025-05-02" }),
      ],
    );
    expect(s.lines.map((l) => l.description)).toEqual(["Cobro (transferencia) – factura 12", "Cobro"]);
  });
});

describe("ajustes en el estado de cuenta", () => {
  it("muestra el ajuste en Haber, descuenta saldo y no cuenta como cobrado", () => {
    const s = buildStatement(
      0,
      [trip({ date: "2025-03-10", price: 1000 })],
      [
        cobro({ date: "2025-03-15", amount: 300 }),
        cobro({ date: "2025-03-31", kind: "ajuste", method: "efectivo", notes: "Saldo histórico 03/2025", amount: 700 }),
      ],
    );
    expect(s.lines[2]).toMatchObject({
      kind: "ajuste",
      description: "Ajuste – Saldo histórico 03/2025",
      debit: 0,
      credit: 700,
      balance: 0,
    });
    expect(s.totalCredit).toBe(1000);
    expect(s.totalCollected).toBe(300);
    expect(s.closing).toBe(0);
  });
});

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
