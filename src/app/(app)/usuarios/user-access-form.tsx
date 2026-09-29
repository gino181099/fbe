"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { TableCell } from "@/components/ui/table";
import type { Level, Module } from "@/db/schema";
import type { ActionResult } from "@/lib/permissions";

const LEVEL_LABELS: Record<Level, string> = { none: "Sin acceso", view: "Ver", edit: "Ver y editar" };

/** Celdas editables (estado + permisos por módulo) de una fila de la tabla de usuarios. */
export function UserAccessCells({
  formId,
  modules,
  status,
  levels,
  action,
  disabled,
}: {
  formId: string;
  modules: readonly Module[];
  status: "pending" | "active" | "disabled";
  levels: Record<Module, Level>;
  action: (formData: FormData) => Promise<ActionResult>;
  disabled?: boolean;
}) {
  const [, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, fd) => {
      const result = await action(fd);
      if (result.ok) toast.success(result.message ?? "Guardado");
      else toast.error(result.error);
      return result;
    },
    null,
  );

  return (
    <>
      <TableCell>
        <form id={formId} action={formAction} />
        <NativeSelect form={formId} name="status" defaultValue={status} size="sm" disabled={disabled} aria-label="Estado">
          <NativeSelectOption value="pending">Pendiente</NativeSelectOption>
          <NativeSelectOption value="active">Activo</NativeSelectOption>
          <NativeSelectOption value="disabled">Deshabilitado</NativeSelectOption>
        </NativeSelect>
      </TableCell>
      {modules.map((m) => (
        <TableCell key={m}>
          <NativeSelect form={formId} name={m} defaultValue={levels[m]} size="sm" disabled={disabled} aria-label={m}>
            {(Object.keys(LEVEL_LABELS) as Level[]).map((l) => (
              <NativeSelectOption key={l} value={l}>
                {LEVEL_LABELS[l]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </TableCell>
      ))}
      <TableCell>
        <Button type="submit" form={formId} size="sm" disabled={disabled || pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </TableCell>
    </>
  );
}
