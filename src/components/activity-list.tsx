import Link from "next/link";
import { CalendarClock, Check, Pencil, RotateCcw } from "lucide-react";
import {
  completeActivity,
  deleteActivity,
  reopenActivity,
  rescheduleActivity,
  saveActivity,
} from "@/app/(app)/agenda/actions";
import { ActivityFields, type FixedLink, type LinkOptions } from "@/components/activity-fields";
import { AuditInfo } from "@/components/audit-info";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { EmptyState, Field } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActivityRow } from "@/lib/activities";
import { activityBucket } from "@/lib/activity-bucket";
import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ActivityListContext = {
  users: { id: string; name: string }[];
  names: Map<string, string>;
  currentUserId: string;
  today: string;
  linkOptions?: LinkOptions;
  fixedLink?: FixedLink;
  /** Mostrar a quién está asignada (agenda de todos, fichas). */
  showAssignee?: boolean;
};

const DUE_CLASSES = {
  vencida: "text-destructive font-medium",
  hoy: "text-amber-700 dark:text-amber-400 font-medium",
  semana: "",
  despues: "text-muted-foreground",
};

/** Lista de actividades con sus acciones: hecha, editar, eliminar (o reabrir si ya está hecha). */
export function ActivityList({ rows, ctx, empty }: { rows: ActivityRow[]; ctx: ActivityListContext; empty?: string }) {
  if (rows.length === 0) return <EmptyState>{empty ?? "No hay actividades."}</EmptyState>;
  return (
    <div className="divide-y rounded-xl border">
      {rows.map((r) => (
        <ActivityItem key={r.activity.id} row={r} ctx={ctx} />
      ))}
    </div>
  );
}

function ActivityItem({ row, ctx }: { row: ActivityRow; ctx: ActivityListContext }) {
  const a = row.activity;
  const name = (id: string | null) => (id ? (ctx.names.get(id) ?? "—") : "—");
  const done = Boolean(a.doneAt);
  const bucket = activityBucket(a.dueDate, ctx.today);
  const links = [
    a.clientId && row.clientName && { href: `/contactos/${a.clientId}`, label: row.clientName },
    a.leadId && row.leadTitle && { href: `/leads/${a.leadId}`, label: row.leadTitle },
    a.vehicleId && row.vehiclePlate && { href: "/flota", label: row.vehiclePlate },
    a.supplierId && row.supplierName && { href: `/finanzas/proveedores/${a.supplierId}`, label: row.supplierName },
  ].filter((l): l is { href: string; label: string } => Boolean(l));
  const assignedByOther = a.createdBy && a.createdBy !== a.assignedTo;

  return (
    <div className={cn("flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap", done && "bg-muted/30")}>
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{ACTIVITY_TYPE_LABELS[a.type]}</Badge>
          <span className={cn("font-medium", done && "text-muted-foreground line-through")}>{a.title}</span>
          {links.map((l) => (
            <Badge key={l.href + l.label} variant="secondary">
              <Link href={l.href}>{l.label}</Link>
            </Badge>
          ))}
        </div>
        {a.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.notes}</p>}
        <p className="text-xs text-muted-foreground">
          {ctx.showAssignee && (
            <>
              Para <span className="font-medium text-foreground/80">{name(a.assignedTo)}</span>
              {" · "}
            </>
          )}
          {assignedByOther && <>Asignada por {name(a.createdBy)} · </>}
          {done ? (
            <>
              Hecha por {name(a.doneBy)} el {formatDateTime(a.doneAt)}
              {a.doneNote && <> — “{a.doneNote}”</>}
            </>
          ) : (
            <span className={DUE_CLASSES[bucket]}>
              {bucket === "vencida" ? "Venció el " : bucket === "hoy" ? "Hoy · " : "Para el "}
              {formatDate(a.dueDate)}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {done ? (
          <ConfirmButton
            action={reopenActivity.bind(null, a.id)}
            title="¿Reabrir la actividad?"
            description="Vuelve a quedar pendiente."
            confirmLabel="Reabrir"
            confirmVariant="default"
            trigger={
              <Button variant="ghost" size="sm">
                <RotateCcw /> Reabrir
              </Button>
            }
          />
        ) : (
          <FormDialog
            title="Marcar como hecha"
            description={a.title}
            action={completeActivity.bind(null, a.id)}
            submitLabel="Hecha"
            successMessage="¡Hecha!"
            trigger={
              <Button variant="outline" size="sm">
                <Check /> Hecha
              </Button>
            }
          >
            <Field label="Resultado (opcional)" htmlFor="doneNote" hint="Ej.: Pagado con transferencia, el cliente pide cotización.">
              <Textarea id="doneNote" name="doneNote" rows={3} maxLength={2000} autoFocus />
            </Field>
            <fieldset className="grid gap-3 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Programar la siguiente (opcional)</legend>
              <p className="text-xs text-muted-foreground">
                Si elegís una fecha, se agenda otra actividad igual (mismo tipo y vínculo) para ese día.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Para cuándo" htmlFor="nextDate">
                  <Input id="nextDate" name="nextDate" type="date" min={ctx.today} />
                </Field>
                <Field label="Asignada a" htmlFor="nextAssignedTo">
                  <NativeSelect id="nextAssignedTo" name="nextAssignedTo" defaultValue={a.assignedTo} className="w-full">
                    {ctx.users.map((u) => (
                      <NativeSelectOption key={u.id} value={u.id}>
                        {u.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Qué hay que hacer" htmlFor="nextTitle" className="sm:col-span-2">
                  <Input id="nextTitle" name="nextTitle" defaultValue={a.title} maxLength={200} />
                </Field>
              </div>
            </fieldset>
          </FormDialog>
        )}
        {!done && (
          <FormDialog
            title="Reprogramar"
            description={a.title}
            action={rescheduleActivity.bind(null, a.id)}
            submitLabel="Reprogramar"
            successMessage="Actividad reprogramada"
            className="sm:max-w-sm"
            trigger={
              <Button variant="ghost" size="icon-sm" title="Reprogramar" aria-label="Reprogramar">
                <CalendarClock className="text-muted-foreground" />
              </Button>
            }
          >
            <Field label="Nueva fecha" htmlFor="rescheduleDate">
              <Input id="rescheduleDate" name="dueDate" type="date" defaultValue={a.dueDate} required autoFocus />
            </Field>
          </FormDialog>
        )}
        <FormDialog
          title="Editar actividad"
          action={saveActivity.bind(null, a.id)}
          className="sm:max-w-xl"
          trigger={
            <Button variant="ghost" size="icon-sm" title="Editar" aria-label="Editar">
              <Pencil className="text-muted-foreground" />
            </Button>
          }
        >
          <ActivityFields
            activity={a}
            users={ctx.users}
            currentUserId={ctx.currentUserId}
            defaultDate={ctx.today}
            linkOptions={ctx.linkOptions}
            linkLabels={{
              clientId: row.clientName,
              leadId: row.leadTitle,
              vehicleId: row.vehiclePlate,
              supplierId: row.supplierName,
            }}
            fixedLink={ctx.fixedLink}
          />
          <AuditInfo row={a} names={ctx.names} />
        </FormDialog>
        <ConfirmButton action={deleteActivity.bind(null, a.id)} title="¿Eliminar actividad?" />
      </div>
    </div>
  );
}
