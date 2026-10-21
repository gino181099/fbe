import { Field } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { leads } from "@/db/schema";
import { LEAD_PRIORITIES, LEAD_PRIORITY_LABELS } from "@/lib/constants";

type Lead = typeof leads.$inferSelect;
export type Option = { id: string | number; name: string };

/** Campos del formulario de oportunidad (alta y edición). */
export function LeadFields({
  lead,
  clientOptions,
  userOptions,
  defaultOwnerId,
}: {
  lead?: Lead;
  clientOptions: Option[];
  userOptions: Option[];
  defaultOwnerId?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Título" htmlFor="title" className="sm:col-span-2" hint="Qué se le propone. Ej.: Traslados vendimia 2027.">
        <Input id="title" name="title" defaultValue={lead?.title} required autoFocus />
      </Field>
      <Field label="Cliente existente" htmlFor="clientId" hint="Solo si es una propuesta a alguien que ya es cliente.">
        <NativeSelect id="clientId" name="clientId" defaultValue={lead?.clientId ?? ""} className="w-full">
          <NativeSelectOption value="">— Prospecto nuevo —</NativeSelectOption>
          {clientOptions.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Empresa" htmlFor="company" hint="Si elegiste un cliente se puede dejar vacío.">
        <Input id="company" name="company" defaultValue={lead?.company ?? ""} />
      </Field>
      <Field label="Persona de contacto" htmlFor="contactPerson">
        <Input id="contactPerson" name="contactPerson" defaultValue={lead?.contactPerson ?? ""} />
      </Field>
      <Field label="Teléfono" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={lead?.phone ?? ""} />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" defaultValue={lead?.email ?? ""} />
      </Field>
      <Field label="Sitio web" htmlFor="website">
        <Input id="website" name="website" inputMode="url" defaultValue={lead?.website ?? ""} />
      </Field>
      <Field label="Dirección" htmlFor="address" className="sm:col-span-2">
        <Input id="address" name="address" defaultValue={lead?.address ?? ""} />
      </Field>
      <Field label="Monto estimado" htmlFor="expectedAmount" hint="Lo que se espera facturar si se gana.">
        <Input
          id="expectedAmount"
          name="expectedAmount"
          inputMode="decimal"
          placeholder="Ej.: 1.500.000"
          defaultValue={lead?.expectedAmount ?? ""}
        />
      </Field>
      <Field label="Cierre estimado" htmlFor="expectedClose">
        <Input id="expectedClose" name="expectedClose" type="date" defaultValue={lead?.expectedClose ?? ""} />
      </Field>
      <Field label="Responsable" htmlFor="ownerId">
        <NativeSelect id="ownerId" name="ownerId" defaultValue={lead?.ownerId ?? defaultOwnerId ?? ""} className="w-full">
          <NativeSelectOption value="">—</NativeSelectOption>
          {userOptions.map((u) => (
            <NativeSelectOption key={u.id} value={u.id}>
              {u.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Prioridad" htmlFor="priority">
        <NativeSelect id="priority" name="priority" defaultValue={lead?.priority ?? ""} className="w-full">
          <NativeSelectOption value="">—</NativeSelectOption>
          {LEAD_PRIORITIES.map((p) => (
            <NativeSelectOption key={p} value={p}>
              {LEAD_PRIORITY_LABELS[p]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Próxima acción" htmlFor="nextAction" hint="Ej.: Llamar para enviar cotización.">
        <Input id="nextAction" name="nextAction" defaultValue={lead?.nextAction ?? ""} />
      </Field>
      <Field label="Fecha de la próxima acción" htmlFor="nextActionDate">
        <Input id="nextActionDate" name="nextActionDate" type="date" defaultValue={lead?.nextActionDate ?? ""} />
      </Field>
      <Field label="Segmento" htmlFor="segment" hint="Ej.: bodegas_turismo, corporativo, mineria_industria.">
        <Input id="segment" name="segment" defaultValue={lead?.segment ?? ""} />
      </Field>
      <Field label="Notas" htmlFor="notes" className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={3} defaultValue={lead?.notes ?? ""} />
      </Field>
    </div>
  );
}
