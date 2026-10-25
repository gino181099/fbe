import { formatDateTime } from "@/lib/format";

export type Audited = {
  createdBy?: string | null;
  createdAt?: Date | null;
  updatedBy?: string | null;
  updatedAt?: Date | null;
};

/** Lo mismo en texto plano (para `title` de una celda o badge). */
export function auditText(row: Audited, names: Map<string, string>) {
  const who = (id: string | null | undefined) => (id ? (names.get(id) ?? "—") : null);
  const parts = [`Creado${row.createdBy ? ` por ${who(row.createdBy)}` : ""}${row.createdAt ? ` el ${formatDateTime(row.createdAt)}` : ""}`];
  if (row.updatedBy) parts.push(`Modificado por ${who(row.updatedBy)}${row.updatedAt ? ` el ${formatDateTime(row.updatedAt)}` : ""}`);
  return parts.join(" · ");
}

/** "Creado por Gino el 25/10/2026, 14:30 · Modificado por Ale el …" (pie de fichas y diálogos de edición). */
export function AuditInfo({ row, names }: { row: Audited; names: Map<string, string> }) {
  const who = (id: string | null | undefined) => (id ? (names.get(id) ?? "—") : null);
  const createdBy = who(row.createdBy);
  const updatedBy = who(row.updatedBy);
  if (!createdBy && !updatedBy && !row.createdAt) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Creado{createdBy && <> por <span className="font-medium text-foreground/80">{createdBy}</span></>}
      {row.createdAt && <> el {formatDateTime(row.createdAt)}</>}
      {updatedBy && (
        <>
          {" · "}Modificado por <span className="font-medium text-foreground/80">{updatedBy}</span>
          {row.updatedAt && <> el {formatDateTime(row.updatedAt)}</>}
        </>
      )}
    </p>
  );
}
