import { Field } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { clients } from "@/db/schema";
import { LEAD_PRIORITIES, LEAD_PRIORITY_LABELS } from "@/lib/constants";

type Client = typeof clients.$inferSelect;

export function ClientFields({ client }: { client?: Client }) {
  // Los prospectos nuevos se cargan en Leads; "Potencial" solo aparece si el contacto ya lo es.
  const prospect = client?.type === "potencial";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nombre / Razón social" htmlFor="name" className="sm:col-span-2">
        <Input id="name" name="name" defaultValue={client?.name} required autoFocus />
      </Field>
      <Field label="Tipo" htmlFor="type" hint="Recurrente: tiene tarifario por recorrido. Especial: servicios puntuales.">
        <NativeSelect id="type" name="type" defaultValue={client?.type ?? "especial"} className="w-full">
          <NativeSelectOption value="recurrente">Recurrente</NativeSelectOption>
          <NativeSelectOption value="especial">Especial</NativeSelectOption>
          {prospect && <NativeSelectOption value="potencial">Potencial</NativeSelectOption>}
        </NativeSelect>
      </Field>
      <Field label="Estado" htmlFor="status">
        <NativeSelect id="status" name="status" defaultValue={client?.status ?? "activo"} className="w-full">
          <NativeSelectOption value="activo">Activo</NativeSelectOption>
          {client?.status === "potencial" && <NativeSelectOption value="potencial">Potencial</NativeSelectOption>}
          <NativeSelectOption value="inactivo">Inactivo</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field label="Persona de contacto" htmlFor="contactPerson">
        <Input id="contactPerson" name="contactPerson" defaultValue={client?.contactPerson ?? ""} />
      </Field>
      <Field label="CUIT" htmlFor="cuit">
        <Input id="cuit" name="cuit" defaultValue={client?.cuit ?? ""} />
      </Field>
      <Field label="Teléfono" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={client?.phone ?? ""} />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" defaultValue={client?.email ?? ""} />
      </Field>
      <Field label="Dirección" htmlFor="address" className="sm:col-span-2">
        <Input id="address" name="address" defaultValue={client?.address ?? ""} />
      </Field>
      <Field label="Sitio web" htmlFor="website" className="sm:col-span-2">
        <Input id="website" name="website" inputMode="url" defaultValue={client?.website ?? ""} />
      </Field>
      <Field label="Segmento" htmlFor="segment" hint="Ej.: bodegas_turismo, corporativo, mineria_industria.">
        <Input id="segment" name="segment" defaultValue={client?.segment ?? ""} />
      </Field>
      <Field label="Prioridad" htmlFor="leadPriority">
        <NativeSelect id="leadPriority" name="leadPriority" defaultValue={client?.leadPriority ?? ""} className="w-full">
          <NativeSelectOption value="">—</NativeSelectOption>
          {LEAD_PRIORITIES.map((p) => (
            <NativeSelectOption key={p} value={p}>
              {LEAD_PRIORITY_LABELS[p]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Notas" htmlFor="notes" className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={3} defaultValue={client?.notes ?? ""} />
      </Field>
    </div>
  );
}
