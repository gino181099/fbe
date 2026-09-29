// Constantes compartidas entre servidor y cliente (sin dependencias de la base).

/** Estaciones de servicio conocidas (sugerencias; se puede escribir otra). */
export const FUEL_SUPPLIERS = ["Axion Sarmiento", "Shell Maza"];
export const DEFAULT_FUEL_SUPPLIER = "Axion Sarmiento";

/** Tipos de movimiento de cobranza: los ajustes descuentan saldo pero no cuentan como cobrado. */
export const COLLECTION_KINDS = ["cobro", "ajuste"] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];
export const COLLECTION_KIND_LABELS: Record<CollectionKind, string> = { cobro: "Cobro", ajuste: "Ajuste" };

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
