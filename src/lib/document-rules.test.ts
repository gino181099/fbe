import { describe, expect, it } from "vitest";
import { type DocumentDraft, itemsTotal, validateDocumentDraft } from "./document-rules";

const CUT = "2026-10-19";
const draft = (d: Partial<DocumentDraft>): DocumentDraft => ({
  type: "nota_debito",
  date: "2026-10-20",
  tripIds: [],
  items: [],
  ...d,
});
const item = (amount: number, description = "Cargo", date = "2026-10-20") => ({ date, description, amount });
const check = (d: Partial<DocumentDraft>) => validateDocumentDraft(draft(d), CUT);

describe("validateDocumentDraft · factura", () => {
  const factura = (d: Partial<DocumentDraft> = {}) =>
    check({ type: "factura", letter: "A", pos: 1, number: 99, tripIds: [1, 2], ...d });

  it("válida con letra A/B/C, punto de venta, número y recorridos", () => {
    expect(factura()).toBeNull();
    expect(factura({ letter: "C", pos: 99999, number: 99999999, dueDate: "2026-11-20" })).toBeNull();
  });

  it("rechaza letra, punto de venta y número inválidos", () => {
    expect(factura({ letter: "X" })).toMatch(/Letra/);
    expect(factura({ letter: null })).toMatch(/letra/);
    expect(factura({ pos: 0 })).toMatch(/Punto de venta/);
    expect(factura({ pos: 100000 })).toMatch(/Punto de venta/);
    expect(factura({ number: null })).toMatch(/Número/);
    expect(factura({ number: 1.5 })).toMatch(/Número/);
    expect(factura({ number: 100000000 })).toMatch(/Número/);
  });

  it("exige al menos un recorrido y no admite ítems libres", () => {
    expect(factura({ tripIds: [] })).toMatch(/recorrido/);
    expect(factura({ tripIds: [1, 1] })).toMatch(/repetidos/);
    expect(factura({ items: [item(100)] })).toMatch(/solo incluye recorridos/);
  });

  it("vencimiento válido y no anterior a la fecha", () => {
    expect(factura({ dueDate: "2026-10-19" })).toMatch(/anterior/);
    expect(factura({ dueDate: "2026-13-01" })).toMatch(/Vencimiento/);
  });

  it("no admite comprobante relacionado", () => {
    expect(factura({ relatedDocumentId: 3 })).toMatch(/relacionado/);
  });
});

describe("validateDocumentDraft · interno", () => {
  it("letra X (o vacía), número automático, solo recorridos", () => {
    expect(check({ type: "interno", tripIds: [3] })).toBeNull();
    expect(check({ type: "interno", letter: "X", tripIds: [3] })).toBeNull();
    expect(check({ type: "interno", letter: "A", tripIds: [3] })).toMatch(/Letra/);
    expect(check({ type: "interno", number: 4, tripIds: [3] })).toMatch(/automático/);
    expect(check({ type: "interno", tripIds: [] })).toMatch(/recorrido/);
  });
});

describe("validateDocumentDraft · ND / saldo inicial (ítems libres)", () => {
  it("al menos un ítem con fecha, detalle y monto > 0", () => {
    expect(check({ items: [item(100), item(50)] })).toBeNull();
    expect(check({ items: [] })).toMatch(/ítem/);
    expect(check({ items: [item(100), item(0)] })).toMatch(/mayor a cero \(ítem 2\)/);
    expect(check({ items: [item(-5)] })).toMatch(/mayor a cero/);
    expect(check({ items: [item(10, "  ")] })).toMatch(/detalle/);
    expect(check({ items: [item(10, "x", "2026-02-30x")] })).toMatch(/Fecha/);
    expect(check({ tripIds: [1], items: [item(10)] })).toMatch(/no incluye recorridos/);
  });

  it("ND: letra y número opcionales, comprobante relacionado opcional", () => {
    expect(check({ letter: "X", pos: 1, number: 5, relatedDocumentId: 2, items: [item(1)] })).toBeNull();
    expect(check({ letter: "Z", items: [item(1)] })).toMatch(/Letra/);
    expect(check({ pos: 2, items: [item(1)] })).toMatch(/Falta el número/);
  });

  it("saldo inicial: puede ser anterior al corte, sin número ni vencimiento", () => {
    const si = (d: Partial<DocumentDraft>) =>
      check({ type: "saldo_inicial", date: "2026-10-01", items: [item(100, "Septiembre", "2026-09-30")], ...d });
    expect(si({})).toBeNull();
    expect(si({ number: 1 })).toMatch(/no lleva letra ni número/);
    expect(si({ letter: "X" })).toMatch(/no lleva letra ni número/);
    expect(si({ dueDate: "2026-11-01" })).toMatch(/vencimiento/);
    expect(si({ relatedDocumentId: 1 })).toMatch(/relacionado/);
  });

  it("los demás tipos no pueden ser anteriores al corte", () => {
    expect(check({ date: "2026-10-18", items: [item(1)] })).toMatch(/saldo inicial/);
    expect(check({ type: "factura", date: "2026-10-18", letter: "A", pos: 1, number: 1, tripIds: [1] })).toMatch(
      /saldo inicial/,
    );
  });
});

describe("validateDocumentDraft · NC / bonificación (un monto)", () => {
  it("exactamente un ítem con concepto y monto > 0", () => {
    expect(check({ type: "nota_credito", relatedDocumentId: 4, items: [item(300, "Descuento")] })).toBeNull();
    expect(check({ type: "bonificacion", items: [item(300, "Cortesía")] })).toBeNull();
    expect(check({ type: "bonificacion", items: [] })).toMatch(/monto y un concepto/);
    expect(check({ type: "nota_credito", items: [item(1), item(2)] })).toMatch(/monto y un concepto/);
    expect(check({ type: "bonificacion", items: [item(0, "x")] })).toMatch(/mayor a cero/);
    expect(check({ type: "bonificacion", items: [item(5, "")] })).toMatch(/detalle/);
  });

  it("bonificación sin número ni relacionado; NC con letra opcional", () => {
    expect(check({ type: "bonificacion", number: 3, items: [item(5)] })).toMatch(/no lleva/);
    expect(check({ type: "bonificacion", relatedDocumentId: 1, items: [item(5)] })).toMatch(/relacionado/);
    expect(check({ type: "nota_credito", letter: "B", pos: 3, number: 8, items: [item(5)] })).toBeNull();
    expect(check({ type: "nota_credito", dueDate: "2026-11-01", items: [item(5)] })).toMatch(/vencimiento/);
  });
});

describe("itemsTotal", () => {
  it("suma y redondea a centavos", () => {
    expect(itemsTotal([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);
    expect(itemsTotal([{ amount: 1500.5 }, { amount: 49999.5 }])).toBe(51500);
    expect(itemsTotal([])).toBe(0);
  });
});
