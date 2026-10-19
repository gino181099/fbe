import { Field } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_FUEL_SUPPLIER,
  type expenses,
  FUEL_SUPPLIERS,
  type fuelLoads,
  type supplierPayments,
  type suppliers,
} from "@/db/schema";
import { PAYMENT_METHODS, SUPPLIER_CATEGORIES, VEHICLE_EXPENSE_CONCEPTS } from "@/lib/constants";

export function SupplierField({ defaultValue, className }: { defaultValue?: string | null; className?: string }) {
  return (
    <Field label="Proveedor / estación" htmlFor="supplier" className={className} hint="Para combustible: la estación de servicio.">
      <Input id="supplier" name="supplier" list="suppliers" defaultValue={defaultValue ?? ""} />
      <datalist id="suppliers">
        {FUEL_SUPPLIERS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </Field>
  );
}

export const EXPENSE_LABELS = { combustible: "Combustible", sueldo: "Sueldos", varios: "Varios" } as const;

export type FleetOptions = {
  drivers: { id: number; name: string; active: boolean }[];
  vehicles: { id: number; plate: string; model: string; active: boolean }[];
};

export function ExpenseFields({
  value,
  defaultDate,
  concepts,
  fleet,
}: {
  value?: typeof expenses.$inferSelect;
  defaultDate: string;
  concepts: string[];
  fleet: FleetOptions;
}) {
  // Sugerencias: conceptos de vehículo primero, después los ya usados.
  const conceptOptions = [...new Set([...VEHICLE_EXPENSE_CONCEPTS, ...concepts])];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Fecha" htmlFor="date">
        <Input id="date" name="date" type="date" defaultValue={value?.date ?? defaultDate} required />
      </Field>
      <Field label="Categoría" htmlFor="category">
        <NativeSelect id="category" name="category" className="w-full" defaultValue={value?.category ?? "varios"}>
          {Object.entries(EXPENSE_LABELS).map(([k, label]) => (
            <NativeSelectOption key={k} value={k}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Concepto" htmlFor="concept" hint="Ej.: Seguro, Impuestos, nombre del chofer…">
        <Input id="concept" name="concept" list="concepts" defaultValue={value?.concept ?? ""} />
        <datalist id="concepts">
          {conceptOptions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <SupplierField defaultValue={value?.supplier} />
      <Field label="Vehículo" htmlFor="vehicleId" hint="Opcional: cuota, seguro, service… de una unidad.">
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
      <Field label="Monto" htmlFor="amount">
        <Input id="amount" name="amount" inputMode="decimal" defaultValue={value?.amount ?? ""} required />
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
