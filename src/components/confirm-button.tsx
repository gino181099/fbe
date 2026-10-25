"use client";

import { type ReactNode, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
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

/** Botón que pide confirmación antes de ejecutar una acción (por defecto, eliminar). */
export function ConfirmButton({
  action,
  title = "¿Eliminar registro?",
  description = "Esta acción no se puede deshacer.",
  confirmLabel = "Eliminar",
  confirmVariant = "destructive",
  trigger,
}: {
  action: () => Promise<ActionResult>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: "destructive" | "default";
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(res.message ?? "Listo");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon-sm" title="Eliminar" aria-label="Eliminar">
            <Trash2 className="text-muted-foreground" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant={confirmVariant} onClick={run} disabled={pending}>
            {pending ? "Procesando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
