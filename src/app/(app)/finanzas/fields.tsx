import { Field } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type collections, DEFAULT_FUEL_SUPPLIER, type expenses, FUEL_SUPPLIERS, type fuelLoads } from "@/db/schema";
import { COLLECTION_KIND_LABELS, COLLECTION_KINDS, VEHICLE_EXPENSE_CONCEPTS } from "@/lib/constants";

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
export const PAYMENT_METHODS = ["Transferencia", "Efectivo", "Cheque", "Mercado Pago", "Otro"];

export function CollectionFields({
  clients,
  value,
  defaultDate,
  defaultClientId,
}: {
  clients: { id: number; name: string }[];
  value?: typeof collections.$inferSelect;
  defaultDate: string;
  defaultClientId?: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Fecha" htmlFor="date">
        <Input id="date" name="date" type="date" defaultValue={value?.date ?? defaultDate} required />
      </Field>
      <Field label="Cliente" htmlFor="clientId">
        <NativeSelect
          id="clientId"
          name="clientId"
          className="w-full"
          defaultValue={value?.clientId ?? defaultClientId ?? ""}
          required
        >
          <NativeSelectOption value="">Elegir…</NativeSelectOption>
          {clients.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Monto" htmlFor="amount" hint="Usá un monto negativo para devoluciones.">
        <Input id="amount" name="amount" inputMode="decimal" defaultValue={value?.amount ?? ""} required />
      </Field>
      <Field label="Tipo" htmlFor="kind" hint="Un ajuste descuenta saldo pero no cuenta como cobrado.">
        <NativeSelect id="kind" name="kind" className="w-full" defaultValue={value?.kind ?? "cobro"}>
          {COLLECTION_KINDS.map((k) => (
            <NativeSelectOption key={k} value={k}>
              {COLLECTION_KIND_LABELS[k]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Medio de pago" htmlFor="method">
        <Input id="method" name="method" list="methods" defaultValue={value?.method ?? ""} />
        <datalist id="methods">
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
