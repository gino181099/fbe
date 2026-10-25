"use client";

// Componentes cliente a propósito: las listas (conceptos, flota, proveedores) viajan una sola vez aunque
// haya un diálogo de edición por fila; renderizadas en el servidor se repetían enteras en cada fila.
import { Field } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { expenses, fuelLoads, supplierPayments, suppliers } from "@/db/schema";
import {
  DEFAULT_FUEL_SUPPLIER,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_SCOPE_LABELS,
  EXPENSE_SCOPES,
  EXPENSE_SUBCATEGORIES,
  FUEL_SUPPLIERS,
  PAYMENT_METHODS,
  SUPPLIER_CATEGORIES,
  VOUCHER_TYPE_LABELS,
  VOUCHER_TYPES,
} from "@/lib/constants";

export function SupplierField({ defaultValue, className }: { defaultValue?: string | null; className?: string }) {
  return (
    <Field label="Estación" htmlFor="supplier" className={className} hint="La estación de servicio de la carga.">
      <Input id="supplier" name="supplier" list="suppliers" defaultValue={defaultValue ?? ""} />
      <datalist id="suppliers">
        {FUEL_SUPPLIERS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </Field>
  );
}

export type FleetOptions = {
  drivers: { id: number; name: string; active: boolean }[];
  vehicles: { id: number; plate: string; model: string; active: boolean }[];
};

export type SupplierOption = { id: number; name: string; active: boolean };

export function ExpenseFields({
  value,
  defaultDate,
  concepts,
  subcategories,
  fleet,
  supplierOptions,
}: {
  value?: typeof expenses.$inferSelect;
  defaultDate: string;
  concepts: string[];
  subcategories: string[];
  fleet: FleetOptions;
  supplierOptions: SupplierOption[];
}) {
  // Sugerencias: subcategorías fijas primero, después las ya usadas.
  const subcategoryOptions = [...new Set([...Object.values(EXPENSE_SUBCATEGORIES).flat(), ...subcategories])];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Fecha" htmlFor="date">
        <Input id="date" name="date" type="date" defaultValue={value?.date ?? defaultDate} required />
      </Field>
      <Field label="Alcance" htmlFor="scope">
        <NativeSelect id="scope" name="scope" className="w-full" defaultValue={value?.scope ?? "general"}>
          {EXPENSE_SCOPES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {EXPENSE_SCOPE_LABELS[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Vehículo" htmlFor="vehicleId" hint="Solo para alcance Vehículo (en General se ignora).">
        <NativeSelect id="vehicleId" name="vehicleId" className="w-full" defaultValue={value?.vehicleId ?? ""}>
          <NativeSelectOption value="">—</NativeSelectOption>
          {fleet.vehicles
            .filter((v) => v.active || v.id === value?.vehicleId)
            .map((v) => (
              <NativeSelectOption key={v.id} value={v.id}>
                {v.plate} · {v.model}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </Field>
      <Field label="Categoría" htmlFor="category">
        <NativeSelect id="category" name="category" className="w-full" defaultValue={value?.category ?? "generales"}>
          {EXPENSE_CATEGORIES.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {EXPENSE_CATEGORY_LABELS[c]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Subcategoría" htmlFor="subcategory" hint="Ej.: Mantenimiento, Sueldos, Alquiler…">
        <Input id="subcategory" name="subcategory" list="expense-subcategories" defaultValue={value?.subcategory ?? ""} />
        <datalist id="expense-subcategories">
          {subcategoryOptions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="Proveedor" htmlFor="supplierId" hint="¿No está? Crealo en Proveedores.">
        <NativeSelect id="supplierId" name="supplierId" className="w-full" defaultValue={value?.supplierId ?? ""}>
          <NativeSelectOption value="">—</NativeSelectOption>
          {supplierOptions
            .filter((s) => s.active || s.id === value?.supplierId)
            .map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </Field>
      <Field label="Qué se hizo" htmlFor="concept">
        <Input id="concept" name="concept" list="concepts" defaultValue={value?.concept ?? ""} />
        <datalist id="concepts">
          {concepts.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="Para qué" htmlFor="purpose">
        <Input id="purpose" name="purpose" defaultValue={value?.purpose ?? ""} />
      </Field>
      <Field label="Comprobante" htmlFor="voucherType">
        <NativeSelect
          id="voucherType"
          name="voucherType"
          className="w-full"
          defaultValue={value?.voucherType ?? "sin_comprobante"}
        >
          {VOUCHER_TYPES.map((t) => (
            <NativeSelectOption key={t} value={t}>
              {VOUCHER_TYPE_LABELS[t]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="N° de comprobante" htmlFor="voucherNumber">
        <Input id="voucherNumber" name="voucherNumber" defaultValue={value?.voucherNumber ?? ""} />
      </Field>
      <Field label="Pago" htmlFor="payment" hint="A pagar: suma a la cuenta del proveedor. Combustible es siempre contado.">
        <NativeSelect id="payment" name="payment" className="w-full" defaultValue={value?.paid === false ? "a_pagar" : "contado"}>
          <NativeSelectOption value="contado">Contado</NativeSelectOption>
          <NativeSelectOption value="a_pagar">A pagar</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field label="Monto" htmlFor="amount">
        <Input id="amount" name="amount" inputMode="decimal" defaultValue={value?.amount ?? ""} required />
      </Field>
      <Field label="Chofer" htmlFor="driverId" hint="Opcional.">
        <NativeSelect id="driverId" name="driverId" className="w-full" defaultValue={value?.driverId ?? ""}>
          <NativeSelectOption value="">—</NativeSelectOption>
          {fleet.drivers
            .filter((d) => d.active || d.id === value?.driverId)
            .map((d) => (
              <NativeSelectOption key={d.id} value={d.id}>
                {d.name}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </Field>
      <Field label="Observaciones" htmlFor="notes" className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={2} defaultValue={value?.notes ?? ""} />
      </Field>
    </div>
  );
}

export function FuelLoadFields({ value, defaultDate }: { value?: typeof fuelLoads.$inferSelect; defaultDate: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Fecha" htmlFor="date">
        <Input id="date" name="date" type="date" defaultValue={value?.date ?? defaultDate} required />
      </Field>
      <Field label="Monto ($)" htmlFor="pesos">
        <Input id="pesos" name="pesos" inputMode="decimal" defaultValue={value?.pesos ?? ""} required />
      </Field>
      <Field label="Litros" htmlFor="liters">
        <Input id="liters" name="liters" inputMode="decimal" defaultValue={value?.liters ?? ""} />
      </Field>
      <SupplierField defaultValue={value?.supplier ?? DEFAULT_FUEL_SUPPLIER} className="sm:col-span-3" />
      <Field label="Observaciones" htmlFor="notes" className="sm:col-span-3">
        <Textarea id="notes" name="notes" rows={2} defaultValue={value?.notes ?? ""} />
      </Field>
    </div>
  );
}

export function SupplierFormFields({
  value,
  categories,
}: {
  value?: typeof suppliers.$inferSelect;
  categories: string[];
}) {
  const options = [...new Set([...SUPPLIER_CATEGORIES, ...categories])];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Nombre"
        htmlFor="name"
        className="sm:col-span-2"
        hint="Para estaciones: igual al usado en recorridos y cargas (así se vincula el gasoil)."
      >
        <Input id="name" name="name" defaultValue={value?.name ?? ""} required />
      </Field>
      <Field label="Rubro" htmlFor="category">
        <Input id="category" name="category" list="supplier-categories" defaultValue={value?.category ?? ""} />
        <datalist id="supplier-categories">
          {options.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="CUIT" htmlFor="cuit">
        <Input id="cuit" name="cuit" defaultValue={value?.cuit ?? ""} />
      </Field>
      <Field label="Emite factura" htmlFor="invoices">
        <NativeSelect id="invoices" name="invoices" className="w-full" defaultValue={value?.invoices === false ? "no" : "si"}>
          <NativeSelectOption value="si">Sí</NativeSelectOption>
          <NativeSelectOption value="no">No</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field label="Observaciones" htmlFor="notes" className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={2} defaultValue={value?.notes ?? ""} />
      </Field>
    </div>
  );
}

export function SupplierPaymentFields({
  value,
  defaultDate,
}: {
  value?: typeof supplierPayments.$inferSelect;
  defaultDate: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Fecha" htmlFor="date">
        <Input id="date" name="date" type="date" defaultValue={value?.date ?? defaultDate} required />
      </Field>
      <Field label="Monto" htmlFor="amount">
        <Input id="amount" name="amount" inputMode="decimal" defaultValue={value?.amount ?? ""} required />
      </Field>
      <Field label="Medio de pago" htmlFor="method" className="sm:col-span-2">
        <Input id="method" name="method" list="payment-methods" defaultValue={value?.method ?? ""} />
        <datalist id="payment-methods">
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>
      <Field label="Observaciones" htmlFor="notes" className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={2} defaultValue={value?.notes ?? ""} />
      </Field>
    </div>
  );
}
