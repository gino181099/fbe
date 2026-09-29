import { addDays } from "./format";

export type NewRate = { routeId: number; capacity: number; price: number };

/** Tarifa vigente (solo los campos que usa el plan). */
export type RateInForce = {
  id: number;
  routeId: number;
  capacity: number;
  validFrom: string;
  validTo: string | null;
};

export type RatePlan = {
  updatePrice: { id: number; price: number }[];
  close: { id: number; validTo: string }[];
  insert: { routeId: number; capacity: number; price: number; validFrom: string; validTo: string | null }[];
};

/**
 * Calcula los cambios de una nueva versión de tarifas desde `validFrom` (sin tocar la base).
 * Por recorrido + categoría: si la vigente empieza ese mismo día se actualiza su precio;
 * si no, se cierra el día anterior y se da de alta la nueva (hereda el `validTo` de la vieja).
 */
export function planRateChanges(current: RateInForce[], validFrom: string, items: NewRate[]): RatePlan {
  const dayBefore = addDays(validFrom, -1);
  const plan: RatePlan = { updatePrice: [], close: [], insert: [] };

  for (const item of items) {
    const old = current.find((r) => r.routeId === item.routeId && r.capacity === item.capacity);
    if (old && old.validFrom === validFrom) {
      plan.updatePrice.push({ id: old.id, price: item.price });
      continue;
    }
    if (old) plan.close.push({ id: old.id, validTo: dayBefore });
    plan.insert.push({
      routeId: item.routeId,
      capacity: item.capacity,
      price: item.price,
      validFrom,
      validTo: old?.validTo ?? null,
    });
  }
  return plan;
}
