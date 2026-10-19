import { describe, expect, it } from "vitest";
import {
  type LedgerCollection,
  type LedgerDocument,
  type LedgerInput,
  type LedgerTrip,
  activeDocuments,
  addDays,
  buildLedger,
  documentNumber,
  statementFromLedger,
  tripsInActiveDocuments,
} from "./ledger";

const CUT = "2026-10-19";

const trip = (t: Partial<LedgerTrip>): LedgerTrip => ({
  id: 1,
  date: "2026-10-20",
  route: "Alta Montaña",
  routeText: null,
  passengers: null,
  capacity: null,
  price: 0,
  ...t,
});

const doc = (d: Partial<LedgerDocument>): LedgerDocument => ({
  id: 1,
  type: "nota_credito",
  letter: null,
  pos: null,
  number: null,
  date: "2026-10-20",
  dueDate: null,
  amount: 0,
  notes: null,
  voidedAt: null,
  items: [],
  ...d,
});

const cobro = (c: Partial<LedgerCollection>): LedgerCollection => ({
  id: 1,
  date: "2026-10-20",
  kind: "cobro",
  method: null,
  notes: null,
  amount: 0,
  ...c,
});

const ledger = (i: Partial<LedgerInput>) =>
  buildLedger({
    trips: [],
    documents: [],
    collections: [],
    paymentDays: 30,
    cutoff: CUT,
    ...i,
  });

const rows = (l: ReturnType<typeof ledger>) =>
  l.lines.map((x) => [x.date, x.kind, x.debit, x.credit, x.balance]);

describe("buildLedger · corte", () => {
  it("lo anterior al corte no suma (recorridos, cobros, notas)", () => {
    const l = ledger({
      trips: [
        trip({ id: 1, date: "2026-10-18", price: 1000 }),
        trip({ id: 2, date: "2026-10-19", price: 300 }),
      ],
      collections: [
        cobro({ date: "2026-10-01", amount: 500 }),
        cobro({ id: 2, date: "2026-10-19", amount: 100 }),
      ],
      documents: [
        doc({ id: 5, type: "nota_debito", date: "2026-10-01", amount: 50 }),
      ],
    });
    expect(rows(l)).toEqual([
      ["2026-10-19", "recorrido", 300, 0, 300],
      ["2026-10-19", "cobro", 0, 100, 200],
    ]);
    expect(l.balance).toBe(200);
  });

  it("factura/interno no generan movimiento ni duplican la deuda; dan el vencimiento", () => {
    const l = ledger({
      trips: [trip({ id: 7, price: 1000 })],
      documents: [
        doc({
          id: 1,
          type: "factura",
          date: "2026-10-21",
          dueDate: "2026-11-05",
          amount: 1000,
          items: [
            { tripId: 7, date: "2026-10-20", description: "x", amount: 1000 },
          ],
        }),
      ],
    });
    expect(rows(l)).toEqual([["2026-10-20", "recorrido", 1000, 0, 1000]]);
    expect(l.balance).toBe(1000);
    expect(l.debits[0].dueDate).toBe("2026-11-05");
  });

  it("comprobante sin vencimiento: su fecha + días de pago", () => {
    const l = ledger({
      paymentDays: 15,
      trips: [trip({ id: 7, price: 1000 })],
      documents: [
        doc({
          type: "interno",
          date: "2026-10-25",
          items: [
            { tripId: 7, date: "2026-10-20", description: "x", amount: 1000 },
          ],
        }),
      ],
    });
    expect(l.debits[0].dueDate).toBe("2026-11-09");
  });

  it("recorrido sin comprobante: fecha + días de pago", () => {
    const l = ledger({
      paymentDays: 30,
      trips: [trip({ date: "2026-12-15", price: 10 })],
    });
    expect(l.debits[0].dueDate).toBe("2027-01-14");
  });

  it("comprobantes anulados no cuentan (ningún tipo)", () => {
    const voided = new Date("2026-10-22T10:00:00Z");
    const l = ledger({
      trips: [trip({ id: 7, price: 1000 })],
      documents: [
        doc({ id: 1, type: "nota_credito", amount: 400, voidedAt: voided }),
        doc({ id: 2, type: "saldo_inicial", amount: 900, voidedAt: voided }),
        doc({
          id: 3,
          type: "factura",
          dueDate: "2026-11-30",
          voidedAt: voided,
          items: [
            { tripId: 7, date: "2026-10-20", description: "x", amount: 1000 },
          ],
        }),
      ],
    });
    expect(l.balance).toBe(1000);
    expect(l.debits[0].dueDate).toBe("2026-11-19");
  });
});

describe("buildLedger · ND, NC, bonificación, ajustes", () => {
  it("ND suma; NC y bonificación restan; ajuste resta sin ser cobro", () => {
    const l = ledger({
      trips: [trip({ price: 1000 })],
      documents: [
        doc({
          id: 1,
          type: "nota_debito",
          letter: "A",
          pos: 1,
          number: 12,
          amount: 200,
          notes: "intereses",
        }),
        doc({
          id: 2,
          type: "nota_credito",
          letter: "A",
          pos: 1,
          number: 3,
          date: "2026-10-21",
          amount: 150,
        }),
        doc({ id: 3, type: "bonificacion", date: "2026-10-22", amount: 50 }),
      ],
      collections: [
        cobro({
          date: "2026-10-23",
          kind: "ajuste",
          notes: "redondeo",
          amount: 10,
        }),
      ],
    });
    expect(rows(l)).toEqual([
      ["2026-10-20", "recorrido", 1000, 0, 1000],
      ["2026-10-20", "nota_debito", 200, 0, 1200],
      ["2026-10-21", "nota_credito", 0, 150, 1050],
      ["2026-10-22", "bonificacion", 0, 50, 1000],
      ["2026-10-23", "ajuste", 0, 10, 990],
    ]);
    expect(l.lines.map((x) => x.description)).toEqual([
      "Alta Montaña",
      "Nota de débito A 0001-00000012 – intereses",
      "Nota de crédito A 0001-00000003",
      "Bonificación",
      "Ajuste – redondeo",
    ]);
    const s = statementFromLedger(l, CUT, "2026-12-31");
    expect(s.totalCollected).toBe(0);
    expect(s.totalCredit).toBe(210);
  });

  it("un cobro negativo aumenta el saldo", () => {
    const l = ledger({
      trips: [trip({ price: 1000 })],
      collections: [cobro({ date: "2026-10-21", amount: -250 })],
    });
    expect(l.lines[1].balance).toBe(1250);
    expect(l.totalCredit).toBe(-250);
  });
});

describe("buildLedger · saldo inicial", () => {
  const si = doc({
    id: 9,
    type: "saldo_inicial",
    date: "2026-09-30",
    amount: 1500,
    items: [
      { tripId: null, date: "2026-08-10", description: "Agosto", amount: 1000 },
      {
        tripId: null,
        date: "2026-09-10",
        description: "Septiembre",
        amount: 500,
      },
    ],
  });

  it("cuenta aunque sea anterior al corte: una línea en la fecha de corte, primera del día", () => {
    const l = ledger({
      trips: [trip({ date: CUT, price: 100 })],
      documents: [si],
    });
    expect(rows(l)).toEqual([
      [CUT, "saldo_inicial", 1500, 0, 1500],
      [CUT, "recorrido", 100, 0, 1600],
    ]);
  });

  it("para FIFO y vencimiento cuenta cada ítem con su fecha", () => {
    const l = ledger({
      documents: [si],
      collections: [cobro({ amount: 1200 })],
    });
    expect(
      l.debits.map((d) => [
        d.description,
        d.paid,
        d.remaining,
        d.status,
        d.dueDate,
      ]),
    ).toEqual([
      ["Agosto", 1000, 0, "cancelado", "2026-09-09"],
      ["Septiembre", 200, 300, "parcial", "2026-10-10"],
    ]);
  });

  it("sin ítems: un solo débito por el total", () => {
    const l = ledger({
      documents: [
        doc({
          type: "saldo_inicial",
          date: "2026-10-25",
          amount: 800,
          notes: "migrado",
        }),
      ],
    });
    expect(l.lines[0]).toMatchObject({
      date: "2026-10-25",
      description: "Saldo inicial – migrado",
      debit: 800,
    });
    expect(l.debits).toHaveLength(1);
  });
});

describe("buildLedger · aplicación de créditos", () => {
  const trips = [
    trip({ id: 1, date: "2026-10-20", price: 1000 }),
    trip({ id: 2, date: "2026-10-21", price: 500 }),
    trip({ id: 3, date: "2026-10-22", price: 300 }),
  ];

  it("FIFO parcial: cancela lo más viejo y deja parcial el siguiente", () => {
    const l = ledger({
      trips,
      collections: [cobro({ date: "2026-10-25", amount: 1200 })],
    });
    expect(
      l.debits.map((d) => [d.tripId, d.paid, d.remaining, d.status]),
    ).toEqual([
      [1, 1000, 0, "cancelado"],
      [2, 200, 300, "parcial"],
      [3, 0, 300, "pendiente"],
    ]);
    expect(l.unappliedCredit).toBe(0);
  });

  it("FIFO total con sobrante = saldo a favor", () => {
    const l = ledger({
      trips,
      collections: [cobro({ amount: 1000 })],
      documents: [doc({ type: "nota_credito", amount: 1000.5 })],
    });
    expect(l.debits.every((d) => d.status === "cancelado")).toBe(true);
    expect(l.unappliedCredit).toBe(200.5);
    expect(l.balance).toBe(-200.5);
  });

  it("asignación explícita antes del FIFO", () => {
    const l = ledger({
      trips,
      collections: [cobro({ id: 4, amount: 600 })],
      allocations: [
        { credit: { source: "collection", id: 4 }, tripId: 3, amount: 300 },
      ],
    });
    expect(l.debits.map((d) => [d.tripId, d.paid, d.status])).toEqual([
      [1, 300, "parcial"],
      [2, 0, "pendiente"],
      [3, 300, "cancelado"],
    ]);
  });

  it("la asignación no supera el crédito ni la deuda del recorrido", () => {
    const l = ledger({
      trips,
      collections: [cobro({ id: 4, amount: 200 })],
      allocations: [
        { credit: { source: "collection", id: 4 }, tripId: 3, amount: 900 },
      ],
    });
    expect(l.debits.find((d) => d.tripId === 3)?.paid).toBe(200);
    expect(l.debits.find((d) => d.tripId === 1)?.paid).toBe(0);
  });

  it("redondea a centavos", () => {
    const l = ledger({
      trips: [trip({ price: 0.1 }), trip({ id: 2, price: 0.2 })],
      collections: [cobro({ amount: 0.3 })],
    });
    expect(l.debits.map((d) => d.status)).toEqual(["cancelado", "cancelado"]);
    expect(l.balance).toBe(0);
  });
});

describe("buildLedger · orden y descripciones", () => {
  it("mismo día: saldo inicial → débitos → créditos, con saldo corrido", () => {
    const l = ledger({
      trips: [
        trip({ id: 1, date: "2026-10-22", price: 300 }),
        trip({ id: 2, date: "2026-10-20", price: 500 }),
      ],
      collections: [
        cobro({ id: 1, date: "2026-10-20", amount: 200 }),
        cobro({ id: 2, date: "2026-10-21", amount: 100 }),
      ],
      documents: [
        doc({ type: "saldo_inicial", date: "2026-10-20", amount: 1000 }),
      ],
    });
    expect(rows(l)).toEqual([
      ["2026-10-20", "saldo_inicial", 1000, 0, 1000],
      ["2026-10-20", "recorrido", 500, 0, 1500],
      ["2026-10-20", "cobro", 0, 200, 1300],
      ["2026-10-21", "cobro", 0, 100, 1200],
      ["2026-10-22", "recorrido", 300, 0, 1500],
    ]);
  });

  it("describe recorridos con ruta, plazas y pasajeros, con fallbacks", () => {
    const l = ledger({
      trips: [
        trip({
          id: 1,
          date: "2026-10-20",
          route: "Ruta",
          capacity: 14,
          passengers: 15,
        }),
        trip({
          id: 2,
          date: "2026-10-21",
          route: null,
          routeText: "Traslado aeropuerto",
        }),
        trip({ id: 3, date: "2026-10-22", route: null, routeText: null }),
      ],
    });
    expect(l.lines.map((x) => x.description)).toEqual([
      "Ruta (14 plazas) · 15 pax",
      "Traslado aeropuerto",
      "Recorrido",
    ]);
  });

  it("describe cobros con método y nota", () => {
    const l = ledger({
      collections: [
        cobro({ id: 1, method: "transferencia", notes: "factura 12" }),
        cobro({ id: 2, date: "2026-10-21" }),
      ],
    });
    expect(l.lines.map((x) => x.description)).toEqual([
      "Cobro (transferencia) – factura 12",
      "Cobro",
    ]);
  });
});

describe("statementFromLedger", () => {
  const l = ledger({
    trips: [
      trip({ id: 1, date: "2026-10-20", price: 1000 }),
      trip({ id: 2, date: "2026-11-05", price: 400 }),
    ],
    collections: [
      cobro({ date: "2026-10-30", amount: 300 }),
      cobro({ id: 2, date: "2026-11-10", kind: "ajuste", amount: 50 }),
    ],
  });

  it("desde anterior al corte: se toma el corte con saldo anterior 0", () => {
    const s = statementFromLedger(l, "2026-01-01", "2026-12-31");
    expect(s.from).toBe(CUT);
    expect(s.opening).toBe(0);
    expect(s.lines).toHaveLength(4);
    expect(s.closing).toBe(1050);
  });

  it("período intermedio: saldo anterior = saldo al día previo; totales del período", () => {
    const s = statementFromLedger(l, "2026-11-01", "2026-11-30");
    expect(s).toMatchObject({
      from: "2026-11-01",
      opening: 700,
      totalDebit: 400,
      totalCredit: 50,
      totalCollected: 0,
      closing: 1050,
    });
  });

  it("excluye lo posterior a `hasta`", () => {
    const s = statementFromLedger(l, CUT, "2026-10-31");
    expect(s.lines).toHaveLength(2);
    expect(s.totalCollected).toBe(300);
    expect(s.closing).toBe(700);
  });
});

describe("helpers", () => {
  it("activeDocuments filtra anulados", () => {
    expect(
      activeDocuments([
        { id: 1, voidedAt: null },
        { id: 2, voidedAt: new Date() },
      ]).map((d) => d.id),
    ).toEqual([1]);
  });

  it("tripsInActiveDocuments: solo factura/interno vigentes, excluyendo el que se edita", () => {
    const items = (ids: number[]) => ids.map((tripId) => ({ tripId }));
    const map = tripsInActiveDocuments(
      [
        { id: 1, type: "factura", voidedAt: null, items: items([10, 11]) },
        {
          id: 2,
          type: "interno",
          voidedAt: "2026-10-20T00:00:00Z",
          items: items([12]),
        },
        { id: 3, type: "nota_credito", voidedAt: null, items: items([13]) },
        { id: 4, type: "interno", voidedAt: null, items: items([14]) },
      ],
      4,
    );
    expect([...map.entries()]).toEqual([
      [10, 1],
      [11, 1],
    ]);
  });

  it("addDays y documentNumber", () => {
    expect(addDays("2026-02-20", 10)).toBe("2026-03-02");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(documentNumber({ letter: "B", pos: 2, number: 45 })).toBe(
      "B 0002-00000045",
    );
    expect(documentNumber({ letter: "X", pos: null, number: 7 })).toBe(
      "X 00000007",
    );
    expect(documentNumber({ letter: null, pos: null, number: null })).toBe("");
  });
});
