import { Field } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { vehicles } from "@/db/schema";

/** Campos del formulario de vehículo (se usan dentro de un `FormDialog`). */
export function VehicleFields({ value }: { value?: typeof vehicles.$inferSelect }) {
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <Field label="Patente" htmlFor="plate" className="sm:col-span-2">
        <Input id="plate" name="plate" defaultValue={value?.plate ?? ""} placeholder="AH115DL" className="uppercase" required />
      </Field>
      <Field label="Modelo" htmlFor="model" className="sm:col-span-3">
        <Input id="model" name="model" defaultValue={value?.model ?? ""} placeholder="Mercedes Benz Sprinter 517 CDI" required />
      </Field>
      <Field label="Plazas" htmlFor="seats" className="sm:col-span-1">
        <Input id="seats" name="seats" type="number" min={1} max={60} defaultValue={value?.seats ?? ""} required />
      </Field>
      <p className="text-xs text-muted-foreground sm:col-span-6">
        Las plazas son un dato de la unidad: no cambian la categoría tarifaria ni el precio de los recorridos.
      </p>
      <Field label="Observaciones" htmlFor="notes" className="sm:col-span-6">
        <Textarea id="notes" name="notes" rows={2} defaultValue={value?.notes ?? ""} />
      </Field>
    </div>
  );
}
