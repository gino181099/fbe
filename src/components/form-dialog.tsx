"use client";

import { type ReactNode, useActionState, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/permissions";

type Props = {
  trigger: ReactNode;
  title: string;
  description?: string;
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel?: string;
  successMessage?: string;
  className?: string;
  children: ReactNode;
};

/** Diálogo con un formulario que llama a una server action y se cierra al guardar. */
export function FormDialog({
  trigger,
  title,
  description,
  action,
  submitLabel = "Guardar",
  successMessage = "Guardado",
  className,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => {
      const result = await action(formData);
      if (result.ok) {
        toast.success(result.message ?? successMessage);
        setOpen(false);
      }
      return result;
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={`max-h-[90svh] overflow-y-auto ${className ?? "sm:max-w-lg"}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {/* key: reinicia el formulario (y el error) cada vez que se abre */}
        <form key={String(open)} action={formAction} className="grid gap-4">
          {children}
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
