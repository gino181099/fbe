import { Field } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { drivers } from "@/db/schema";

/** Campos del formulario de chofer (se usan dentro de un `FormDialog`). */
export function DriverFields({ value }: { value?: typeof drivers.$inferSelect }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nombre" htmlFor="name">
        <Input id="name" name="name" defaultValue={value?.name ?? ""} required />
      </Field>
      <Field label="Teléfono" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={value?.phone ?? ""} />
      </Field>
      <Field label="Observaciones" htmlFor="notes" className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={2} defaultValue={value?.notes ?? ""} />
      </Field>
    </div>
  );
}
