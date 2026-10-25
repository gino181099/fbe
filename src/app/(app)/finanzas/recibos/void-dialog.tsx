import type { ReactNode } from "react";
import { Ban } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { voidReceipt } from "./actions";

/** Anular un recibo con motivo opcional. */
export function VoidReceiptDialog({ id, label, children }: { id: number; label: string; children?: ReactNode }) {
  return (
    <FormDialog
      title={`Anular ${label}`}
      description="El recibo deja de contar en el saldo y sus recorridos vuelven a quedar pendientes. El número no se reutiliza."
      action={voidReceipt.bind(null, id)}
      submitLabel="Anular"
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Anular">
          <Ban className="text-muted-foreground" />
        </Button>
      }
    >
      <Field label="Motivo (opcional)" htmlFor={`reason-${id}`}>
        <Textarea id={`reason-${id}`} name="reason" maxLength={500} />
      </Field>
      {children}
    </FormDialog>
  );
}
