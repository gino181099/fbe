import type { ExpenseCategory, ExpenseScope, VoucherType } from "./constants";

export type ExpenseInput = {
  date: string;
  scope: ExpenseScope;
  category: ExpenseCategory;
  subcategory?: string;
  concept?: string;
  purpose?: string;
  supplierId?: number;
  voucherType: VoucherType;
  voucherNumber?: string;
  payment: "contado" | "a_pagar";
  amount: number;
  notes?: string;
  vehicleId?: number;
  driverId?: number;
};

/**
 * Reglas del formulario de gasto (T-022): alcance Vehículo exige vehículo y General lo ignora; "a pagar"
 * exige proveedor; combustible (pago a estación del gasoil ya contado) exige proveedor y es siempre contado.
 */
export function resolveExpense(d: ExpenseInput) {
  const isVehicle = d.scope === "vehiculo";
  const isFuel = d.category === "combustible";
  if (isVehicle && !d.vehicleId) return { ok: false, error: "Elegí el vehículo" } as const;
  if (isFuel && !d.supplierId) return { ok: false, error: "Para combustible elegí la estación (proveedor)" } as const;
  if (!isFuel && d.payment === "a_pagar" && !d.supplierId)
    return { ok: false, error: "Para dejarlo a pagar elegí un proveedor" } as const;
  return {
    ok: true,
    values: {
      date: d.date,
      scope: d.scope,
      category: d.category,
      subcategory: d.subcategory ?? null,
      concept: d.concept ?? null,
      purpose: d.purpose ?? null,
      supplierId: d.supplierId ?? null,
      voucherType: d.voucherType,
      voucherNumber: d.voucherType === "sin_comprobante" ? null : (d.voucherNumber ?? null),
      paid: isFuel || d.payment === "contado",
      amount: d.amount,
      notes: d.notes ?? null,
      // Check en la base: scope = vehiculo ⇔ vehicle_id no nulo.
      vehicleId: isVehicle ? (d.vehicleId ?? null) : null,
      driverId: d.driverId ?? null,
    },
  } as const;
}
