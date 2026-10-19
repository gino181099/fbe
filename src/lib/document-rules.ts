// Reglas de comprobantes por tipo (lógica pura, segura para cliente). Las usa la acción de alta.
import { CC_START, type DocumentType } from "./constants";

/** Letras permitidas por tipo (vacío = no lleva letra ni número). */
export const DOCUMENT_LETTERS: Record<DocumentType, readonly string[]> = {
  factura: ["A", "B", "C"],
  interno: ["X"],
  nota_debito: ["A", "B", "C", "X"],
  nota_credito: ["A", "B", "C", "X"],
  bonificacion: [],
  saldo_inicial: [],
};

/** Factura / interno: documentan recorridos (sin ítems libres). */
export const usesTrips = (t: DocumentType) => t === "factura" || t === "interno";
/** ND / saldo inicial: ítems libres (fecha, detalle, monto). */
export const usesFreeItems = (t: DocumentType) => t === "nota_debito" || t === "saldo_inicial";
/** NC / bonificación: un único monto + concepto. */
export const usesSingleAmount = (t: DocumentType) => t === "nota_credito" || t === "bonificacion";
/** ND / NC: pueden referir a otro comprobante del cliente. */
export const allowsRelated = (t: DocumentType) => t === "nota_debito" || t === "nota_credito";
/** Tipos con vencimiento propio. */
export const hasDueDate = (t: DocumentType) => t === "factura" || t === "interno" || t === "nota_debito";

export const MAX_POS = 99999;
export const MAX_NUMBER = 99999999;

export type DocumentItemDraft = { date: string; description: string; amount: number };

export type DocumentDraft = {
  type: DocumentType;
  date: string;
  dueDate?: string | null;
  letter?: string | null;
  pos?: number | null;
  number?: number | null;
  relatedDocumentId?: number | null;
  tripIds: number[];
  items: DocumentItemDraft[];
};

const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const isInt = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Σ montos (redondeado a centavos). */
export const itemsTotal = (items: { amount: number }[]) => round2(items.reduce((s, i) => s + i.amount, 0));

/**
 * Valida el borrador según su tipo. Devuelve el mensaje de error o null.
 * Los recorridos (cliente, corte, otro comprobante vigente) se validan aparte contra la base.
 */
export function validateDocumentDraft(d: DocumentDraft, cutoff = CC_START): string | null {
  if (!isDate(d.date)) return "Fecha inválida.";
  if (d.type !== "saldo_inicial" && d.date < cutoff) {
    return "La fecha es anterior al inicio de la cuenta corriente: lo previo va como saldo inicial.";
  }
  if (d.dueDate != null) {
    if (!hasDueDate(d.type)) return "Este comprobante no lleva vencimiento.";
    if (!isDate(d.dueDate)) return "Vencimiento inválido.";
    if (d.dueDate < d.date) return "El vencimiento es anterior a la fecha.";
  }

  // Letra y número.
  const letters = DOCUMENT_LETTERS[d.type];
  const letter = d.letter ?? null;
  if (letters.length === 0) {
    if (letter != null || d.pos != null || d.number != null) return "Este comprobante no lleva letra ni número.";
  } else if (letter != null && !letters.includes(letter)) {
    return `Letra inválida: usá ${letters.join(", ")}.`;
  }
  if (d.type === "factura") {
    if (letter == null) return "Elegí la letra de la factura.";
    if (!isInt(d.pos, 1, MAX_POS)) return `Punto de venta inválido (1 a ${MAX_POS}).`;
    if (!isInt(d.number, 1, MAX_NUMBER)) return `Número inválido (1 a ${MAX_NUMBER}).`;
  } else if (d.type === "interno") {
    // Letra X, punto de venta 1 y número automático (los pone la acción).
    if (d.pos != null || d.number != null) return "El número del comprobante interno es automático.";
  } else if (allowsRelated(d.type)) {
    if (d.pos != null && !isInt(d.pos, 1, MAX_POS)) return `Punto de venta inválido (1 a ${MAX_POS}).`;
    if (d.number != null && !isInt(d.number, 1, MAX_NUMBER)) return `Número inválido (1 a ${MAX_NUMBER}).`;
    if (d.pos != null && d.number == null) return "Falta el número del comprobante.";
  }

  if (d.relatedDocumentId != null && !allowsRelated(d.type)) {
    return "Solo las notas de débito y crédito tienen comprobante relacionado.";
  }

  // Contenido: recorridos o ítems.
  if (usesTrips(d.type)) {
    if (d.items.length) return "Este comprobante solo incluye recorridos (los cargos extra van por nota de débito).";
    if (d.tripIds.length === 0) return "Tildá al menos un recorrido.";
    if (new Set(d.tripIds).size !== d.tripIds.length) return "Hay recorridos repetidos.";
    return null;
  }
  if (d.tripIds.length) return "Este comprobante no incluye recorridos.";
  if (usesSingleAmount(d.type) && d.items.length !== 1) return "Indicá un monto y un concepto.";
  if (d.items.length === 0) return "Agregá al menos un ítem.";
  for (const [i, it] of d.items.entries()) {
    const n = d.items.length > 1 ? ` (ítem ${i + 1})` : "";
    if (!isDate(it.date)) return `Fecha inválida${n}.`;
    if (!it.description.trim()) return `Falta el detalle${n}.`;
    if (!Number.isFinite(it.amount) || it.amount <= 0) return `El monto tiene que ser mayor a cero${n}.`;
  }
  return null;
}
