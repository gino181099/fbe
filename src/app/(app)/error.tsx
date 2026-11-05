"use client";

import { useEffect, useTransition } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Error al cargar una sección (ej. la base tardó en despertar o se cortó): mensaje en castellano y reintento. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="surface mx-auto grid max-w-md justify-items-center gap-3 p-8 text-center">
      <TriangleAlert className="size-8 text-destructive" />
      <h1 className="text-lg font-semibold">No se pudo cargar esta sección</h1>
      <p className="text-sm text-muted-foreground">
        Puede ser un corte momentáneo de la conexión con la base de datos. Probá de nuevo en unos segundos; si sigue
        fallando, avisale a Gino.
      </p>
      <Button onClick={() => startTransition(retry)} disabled={pending}>
        <RotateCw className={pending ? "animate-spin" : undefined} /> {pending ? "Reintentando…" : "Reintentar"}
      </Button>
    </div>
  );
}
