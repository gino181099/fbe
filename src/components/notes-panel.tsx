import Link from "next/link";
import { Plus } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { EmptyState, Field } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import type { ActionResult } from "@/lib/permissions";

export type NoteRow = {
  key: string;
  date: string;
  text: string;
  auto: boolean;
  author: string | null;
  /** De dónde viene la nota cuando se muestra en otra ficha (ej. la oportunidad o el contacto). */
  source?: { label: string; href?: string };
  /** Solo si el usuario puede borrarla. */
  onDelete?: () => Promise<ActionResult>;
};

/** Notas de seguimiento (contactos y leads): alta con fecha y lista con autor. */
export function NotesPanel({
  notes,
  addAction,
  date,
}: {
  notes: NoteRow[];
  /** Sin permiso de edición no se pasa y no aparece el botón. */
  addAction?: (formData: FormData) => Promise<ActionResult>;
  date: string;
}) {
  const canDelete = notes.some((n) => n.onDelete);
  return (
    <div className="grid gap-3">
      {addAction && (
        <FormDialog
          title="Agregar nota"
          action={addAction}
          successMessage="Nota agregada"
          trigger={
            <Button variant="outline" className="w-fit">
              <Plus /> Agregar nota
            </Button>
          }
        >
          <div className="grid gap-4">
            <Field label="Fecha" htmlFor="note-date">
              <Input id="note-date" name="date" type="date" defaultValue={date} required className="w-44" />
            </Field>
            <Field label="Nota" htmlFor="note-text" hint="Llamadas, reuniones, pedidos, acuerdos, lo que sirva recordar.">
              <Textarea id="note-text" name="text" rows={5} maxLength={2000} required autoFocus />
            </Field>
          </div>
        </FormDialog>
      )}
      {notes.length === 0 ? (
        <EmptyState>Todavía no hay notas.</EmptyState>
      ) : (
        <div className="surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="w-36">Autor</TableHead>
                {canDelete && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map((n) => (
                <TableRow key={n.key} className={n.auto ? "text-muted-foreground" : undefined}>
                  <TableCell className="align-top">{formatDate(n.date)}</TableCell>
                  <TableCell className="whitespace-pre-wrap align-top">
                    {n.auto && (
                      <Badge variant="outline" className="mr-2">
                        Automática
                      </Badge>
                    )}
                    {n.source && (
                      <Badge variant="secondary" className="mr-2">
                        {n.source.href ? <Link href={n.source.href}>{n.source.label}</Link> : n.source.label}
                      </Badge>
                    )}
                    {n.text}
                  </TableCell>
                  <TableCell className="align-top">{n.author ?? (n.auto ? "Sistema" : "—")}</TableCell>
                  {canDelete && (
                    <TableCell className="align-top">
                      {n.onDelete && <ConfirmButton action={n.onDelete} title="¿Eliminar nota?" />}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** Une notas de dos fuentes (más nuevas primero) sin repetir las copiadas al migrar (misma fecha y texto). */
export function mergeNotes(own: NoteRow[], other: NoteRow[]) {
  const seen = new Set(own.map((n) => `${n.date}|${n.text}`));
  return [...own, ...other.filter((n) => !seen.has(`${n.date}|${n.text}`))].sort((a, b) =>
    a.date === b.date ? 0 : a.date < b.date ? 1 : -1,
  );
}
