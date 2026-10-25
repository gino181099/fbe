"use client";

import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { rescheduleActivity } from "@/app/(app)/agenda/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MIME = "application/x-frabel-activity";

/** Día del calendario: soltar una actividad acá la reprograma para esta fecha. */
export function CalendarDay({ date, className, children }: { date: string; className?: string; children: ReactNode }) {
  const [over, setOver] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn(className, over && "bg-primary/10 ring-2 ring-primary/40 ring-inset", pending && "opacity-60")}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const raw = e.dataTransfer.getData(MIME);
        if (!raw) return;
        e.preventDefault();
        const { id, from } = JSON.parse(raw) as { id: number; from: string };
        if (from === date) return;
        const fd = new FormData();
        fd.set("dueDate", date);
        startTransition(async () => {
          const res = await rescheduleActivity(id, fd);
          if (res.ok) toast.success(`Reprogramada para el ${date.split("-").reverse().join("/")}`);
          else toast.error(res.error);
        });
      }}
    >
      {children}
    </div>
  );
}

/**
 * Actividad en el calendario: se arrastra a otro día (si está pendiente) y al hacer clic abre su detalle
 * con las mismas acciones de la lista (hecha, reprogramar, editar, eliminar).
 */
export function CalendarChip({
  id,
  date,
  draggable,
  className,
  label,
  title,
  children,
}: {
  id: number;
  date: string;
  draggable: boolean;
  className?: string;
  label: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          draggable={draggable}
          onDragStart={(e) => {
            e.dataTransfer.setData(MIME, JSON.stringify({ id, from: date }));
            e.dataTransfer.effectAllowed = "move";
          }}
          title={title}
          className={cn(
            "block w-full truncate rounded border px-1.5 py-0.5 text-left text-xs leading-snug",
            draggable && "cursor-grab active:cursor-grabbing",
            className,
          )}
        >
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Actividad</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
