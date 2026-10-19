import { Ban } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { voidDocument } from "./actions";

/** Anular un comprobante con motivo opcional. */
export function VoidDialog({ id, label }: { id: number; label: string }) {
  return (
    <FormDialog
      title={`Anular ${label}`}
      description="El comprobante deja de contar en el saldo y sus recorridos quedan sin comprobante. El número no se reutiliza."
      action={voidDocument.bind(null, id)}
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
    </FormDialog>
  );
}
