import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto mientras carga cualquier sección: la navegación responde al instante. */
export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Cargando">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid gap-2 rounded-xl border p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}
