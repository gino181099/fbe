"use client";

// Cliente a propósito: va en el diálogo de edición de cada fila; así React manda las listas de
// vínculos (contactos, leads, vehículos, proveedores) una sola vez y no repetidas por actividad.
import { Field } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { activities } from "@/db/schema";
import { ACTIVITY_TYPE_LABELS, ACTIVITY_TYPES } from "@/lib/constants";

type Activity = typeof activities.$inferSelect;
type Option = { id: string | number; name: string };
export type LinkOptions = { clients: Option[]; leads: Option[]; vehicles: Option[]; suppliers: Option[] };
/** Vínculo fijo cuando la actividad se agenda desde una ficha (contacto, oportunidad, proveedor). */
export type FixedLink = { field: "clientId" | "leadId" | "vehicleId" | "supplierId"; id: number; label: string };

const LINKS = [
  { field: "clientId", label: "Contacto", key: "clients" },
  { field: "leadId", label: "Oportunidad", key: "leads" },
  { field: "vehicleId", label: "Vehículo", key: "vehicles" },
  { field: "supplierId", label: "Proveedor", key: "suppliers" },
] as const;

/** Campos de una actividad (alta y edición). */
export function ActivityFields({
  activity,
  users,
  currentUserId,
  defaultDate,
  linkOptions,
  linkLabels,
  fixedLink,
}: {
  activity?: Activity;
  users: Option[];
  currentUserId: string;
  defaultDate: string;
  /** Sin vínculo fijo: selects para elegir con qué se relaciona. */
  linkOptions?: LinkOptions;
  /** Nombres de lo vinculado hoy (por si ya no figura entre las opciones, ej. una oportunidad cerrada). */
  linkLabels?: Partial<Record<FixedLink["field"], string | null>>;
  fixedLink?: FixedLink;
}) {
  const optionsFor = (l: (typeof LINKS)[number]) => {
    const list = linkOptions?.[l.key] ?? [];
    const current = activity?.[l.field];
    return current && !list.some((o) => o.id === current)
      ? [{ id: current, name: linkLabels?.[l.field] ?? `#${current}` }, ...list]
      : list;
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Qué hay que hacer" htmlFor="act-title" className="sm:col-span-2">
        <Input
          id="act-title"
          name="title"
          defaultValue={activity?.title}
          placeholder="Ej.: Pagar seguro de la Sprinter"
          maxLength={200}
          required
          autoFocus
        />
      </Field>
      <Field label="Tipo" htmlFor="act-type">
        <NativeSelect id="act-type" name="type" defaultValue={activity?.type ?? "tarea"} className="w-full">
          {ACTIVITY_TYPES.map((t) => (
            <NativeSelectOption key={t} value={t}>
              {ACTIVITY_TYPE_LABELS[t]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Para cuándo" htmlFor="act-due">
        <Input id="act-due" name="dueDate" type="date" defaultValue={activity?.dueDate ?? defaultDate} required />
      </Field>
      <Field label="Asignada a" htmlFor="act-assigned" className="sm:col-span-2" hint="Podés asignarle la actividad a otra persona.">
        <NativeSelect
          id="act-assigned"
          name="assignedTo"
          defaultValue={activity?.assignedTo ?? currentUserId}
          className="w-full"
        >
          {users.map((u) => (
            <NativeSelectOption key={u.id} value={u.id}>
              {u.id === currentUserId ? `${u.name} (yo)` : u.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {fixedLink ? (
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Vinculada a <span className="font-medium text-foreground">{fixedLink.label}</span>
          <input type="hidden" name={fixedLink.field} value={fixedLink.id} />
        </p>
      ) : (
        linkOptions &&
        LINKS.map((l) => (
          <Field key={l.field} label={`${l.label} (opcional)`} htmlFor={`act-${l.field}`}>
            <NativeSelect
              id={`act-${l.field}`}
              name={l.field}
              defaultValue={activity?.[l.field] ?? ""}
              className="w-full"
            >
              <NativeSelectOption value="">—</NativeSelectOption>
              {optionsFor(l).map((o) => (
                <NativeSelectOption key={o.id} value={o.id}>
                  {o.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        ))
      )}
      <Field label="Detalle" htmlFor="act-notes" className="sm:col-span-2">
        <Textarea id="act-notes" name="notes" rows={3} maxLength={2000} defaultValue={activity?.notes ?? ""} />
      </Field>
    </div>
  );
}
