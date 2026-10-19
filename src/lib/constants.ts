// Constantes compartidas entre servidor y cliente (sin dependencias de la base).

/** Estaciones de servicio conocidas (sugerencias; se puede escribir otra). */
export const FUEL_SUPPLIERS = ["Axion Sarmiento", "Shell Maza"];
export const DEFAULT_FUEL_SUPPLIER = "Axion Sarmiento";

/** Tipos de movimiento de cobranza: los ajustes descuentan saldo pero no cuentan como cobrado. */
export const COLLECTION_KINDS = ["cobro", "ajuste"] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];
export const COLLECTION_KIND_LABELS: Record<CollectionKind, string> = { cobro: "Cobro", ajuste: "Ajuste" };

/** Inicio de la cuenta corriente con comprobantes: antes de esta fecha nada suma al saldo (salvo el saldo inicial). */
export const CC_START = "2026-10-19";

/**
 * Tipos de comprobante. Factura/interno solo agrupan recorridos (no mueven saldo); ND y saldo inicial
 * son débitos; NC y bonificación, créditos.
 */
export const DOCUMENT_TYPES = [
  "factura",
  "interno",
  "nota_debito",
  "nota_credito",
  "bonificacion",
  "saldo_inicial",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  factura: "Factura",
  interno: "Comprobante interno",
  nota_debito: "Nota de débito",
  nota_credito: "Nota de crédito",
  bonificacion: "Bonificación",
  saldo_inicial: "Saldo inicial",
};

/** Tipos de línea del estado de cuenta. */
export const MOVEMENT_KINDS = [
  "recorrido",
  "saldo_inicial",
  "nota_debito",
  "nota_credito",
  "bonificacion",
  "cobro",
  "ajuste",
] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];
export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  recorrido: "Recorrido",
  saldo_inicial: "Saldo inicial",
  nota_debito: "Nota de débito",
  nota_credito: "Nota de crédito",
  bonificacion: "Bonificación",
  cobro: "Cobro",
  ajuste: "Ajuste",
};

/** Conceptos sugeridos para gastos de un vehículo (se puede escribir otro). */
export const VEHICLE_EXPENSE_CONCEPTS = ["Cuota", "Seguro", "Service", "Patente", "VTV", "Neumáticos", "Reparación"];

/** Patente normalizada: mayúsculas, sin espacios ni guiones ("ah 115-dl" → "AH115DL"). */
export function normalizePlate(s: string) {
  return s.toUpperCase().replace(/[\s-]+/g, "");
}

/** Tipos de cliente. "potencial" = prospecto dentro del embudo comercial. */
export const CLIENT_TYPES = ["recurrente", "especial", "potencial"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];
export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  recurrente: "Recurrente",
  especial: "Especial",
  potencial: "Potencial",
};

/** Etapas del embudo de clientes potenciales. */
export const LEAD_STAGES = ["sin_contactar", "contactado", "ganado", "perdido"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  sin_contactar: "Sin contactar",
  contactado: "Contactado",
  ganado: "Ganado",
  perdido: "Perdido",
};

export const LEAD_PRIORITIES = ["alta", "media", "baja"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];
export const LEAD_PRIORITY_LABELS: Record<LeadPriority, string> = { alta: "Alta", media: "Media", baja: "Baja" };
