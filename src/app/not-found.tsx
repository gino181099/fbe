import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Página inexistente (o un id que no está en la base). */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="surface grid max-w-md justify-items-center gap-3 p-8 text-center">
        <p className="text-4xl font-semibold text-muted-foreground">404</p>
        <h1 className="text-lg font-semibold">No encontramos lo que buscás</h1>
        <p className="text-sm text-muted-foreground">Puede que se haya borrado o que el enlace esté mal.</p>
        <Button asChild>
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
