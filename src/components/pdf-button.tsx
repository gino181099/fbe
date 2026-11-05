"use client";

import { type ComponentProps, type ReactNode, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Descarga un PDF de `/api/...` mostrando que se está generando: el primero tras un arranque en frío
 * de Vercel tarda varios segundos (react-pdf) y con un <a> común parecía que el botón no hacía nada.
 */
export function PdfButton({
  href,
  children,
  label = "Descargar PDF",
  iconOnly = false,
  ...props
}: {
  href: string;
  children: ReactNode;
  label?: string;
  iconOnly?: boolean;
} & Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">) {
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error((await res.text()) || `Error ${res.status}`);
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "documento.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      toast.error(`No se pudo generar el PDF: ${e instanceof Error ? e.message : "error desconocido"}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={download}
      disabled={pending}
      aria-label={iconOnly ? label : undefined}
      title={pending ? "Generando PDF…" : iconOnly ? label : undefined}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" />
          {!iconOnly && "Generando PDF…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
