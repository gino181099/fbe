"use client";

import { Field } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Rate = { routeId: number; capacity: number; price: number; validFrom: string; validTo: string | null };

// Componente cliente a propósito: la lista de recorridos viaja una sola vez aunque haya un diálogo por fila
// (renderizada en el servidor se repetía entera en cada fila).
export function RateFields({ value, routes }: { value: Rate; routes: { id: number; name: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Recorrido" htmlFor="routeId">
        <NativeSelect id="routeId" name="routeId" defaultValue={value.routeId} className="w-full">
          {routes.map((x) => (
            <NativeSelectOption key={x.id} value={x.id}>
              {x.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Capacidad" htmlFor="capacity">
        <Input id="capacity" name="capacity" type="number" defaultValue={value.capacity} />
      </Field>
      <Field label="Precio" htmlFor="price" className="sm:col-span-2">
        <Input id="price" name="price" inputMode="decimal" defaultValue={value.price} />
      </Field>
      <Field label="Vigente desde" htmlFor="validFrom">
        <Input id="validFrom" name="validFrom" type="date" defaultValue={value.validFrom} />
      </Field>
      <Field label="Hasta (vacío = sin fin)" htmlFor="validTo">
        <Input id="validTo" name="validTo" type="date" defaultValue={value.validTo ?? ""} />
      </Field>
    </div>
  );
}
