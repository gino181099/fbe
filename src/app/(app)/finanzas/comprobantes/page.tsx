import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { FileDown, Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "@/lib/constants";
import { formatDocNumber } from "@/lib/doc-number";
import { listDocuments } from "@/lib/documents";
import { formatDate, formatMoney } from "@/lib/format";
import { AuditInfo, auditText } from "@/components/audit-info";
import { getUserNames } from "@/lib/audit";
import { can, requirePermission } from "@/lib/permissions";
import { VoidDialog } from "./void-dialog";

export const metadata: Metadata = { title: "Comprobantes" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const STATUSES = ["vigentes", "anulados", "todos"] as const;

export default async function DocumentsPage({ searchParams }: PageProps<"/finanzas/comprobantes">) {
  const user = await requirePermission("finanzas");
  const sp = await searchParams;
  const desde = isDate(str(sp.desde));
  const hasta = isDate(str(sp.hasta));
  const clienteId = Number(str(sp.cliente)) || undefined;
  const tipo = DOCUMENT_TYPES.find((t) => t === str(sp.tipo));
  const estado = STATUSES.find((s) => s === str(sp.estado)) ?? "vigentes";

  const [rows, clientList, names] = await Promise.all([
    listDocuments({ type: tipo, clientId: clienteId, from: desde, to: hasta, status: estado }),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
    getUserNames(),
  ]);
  const canEdit = can(user, "finanzas", "edit");
  // Los anulados no suman (salvo cuando se listan solo anulados).
  const counted = estado === "anulados" ? rows : rows.filter((r) => r.d.voidedAt == null);
  const totals = DOCUMENT_TYPES.map((t) => ({
    type: t,
    count: counted.filter((r) => r.d.type === t).length,
    total: counted.reduce((s, r) => s + (r.d.type === t ? r.d.amount : 0), 0),
  })).filter((t) => t.count > 0);
  const newHref = `/finanzas/comprobantes/nuevo${clienteId ? `?cliente=${clienteId}` : ""}`;

  return (
    <>
      <PageHeader
        title="Comprobantes"
        description="Facturas (hechas en ARCA), comprobantes internos, notas de débito y crédito, bonificaciones y saldos iniciales. No se editan ni se borran: se anulan."
        actions={
          canEdit && (
            <Button asChild>
              <Link href={newHref}>
                <Plus /> Nuevo comprobante
              </Link>
            </Button>
          )
        }
      />

      <form className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Desde
          <Input type="date" name="desde" defaultValue={desde} className="w-40" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Hasta
          <Input type="date" name="hasta" defaultValue={hasta} className="w-40" />
        </label>
        <NativeSelect name="cliente" defaultValue={clienteId ?? ""} aria-label="Cliente">
          <NativeSelectOption value="">Todos los clientes</NativeSelectOption>
          {clientList.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="tipo" defaultValue={tipo ?? ""} aria-label="Tipo">
          <NativeSelectOption value="">Tipo: Todos</NativeSelectOption>
          {DOCUMENT_TYPES.map((t) => (
            <NativeSelectOption key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="estado" defaultValue={estado} aria-label="Estado">
          <NativeSelectOption value="vigentes">Vigentes</NativeSelectOption>
          <NativeSelectOption value="anulados">Anulados</NativeSelectOption>
          <NativeSelectOption value="todos">Todos</NativeSelectOption>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {(desde || hasta || clienteId || tipo || estado !== "vigentes") && (
          <Button variant="ghost" asChild>
            <Link href="/finanzas/comprobantes">Limpiar</Link>
          </Button>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState>No hay comprobantes con esos filtros.</EmptyState>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ d, clientName }) => {
                const voided = d.voidedAt != null;
                const number = formatDocNumber(d.letter, d.pos, d.number);
                return (
                  <TableRow key={d.id} className={voided ? "text-muted-foreground" : undefined}>
                    <TableCell>{formatDate(d.date)}</TableCell>
                    <TableCell className={voided ? "line-through" : undefined}>{DOCUMENT_TYPE_LABELS[d.type]}</TableCell>
                    <TableCell className={`tabular-nums ${voided ? "line-through" : ""}`}>{number || "—"}</TableCell>
                    <TableCell>
                      <Link href={`/finanzas/cuentas/${d.clientId}`} className="hover:underline">
                        {clientName}
                      </Link>
                      {d.notes && <span className="block text-xs text-muted-foreground">{d.notes}</span>}
                    </TableCell>
                    <TableCell>{d.dueDate ? formatDate(d.dueDate) : "—"}</TableCell>
                    <TableCell className={`text-right tabular-nums ${voided ? "line-through" : ""}`}>
                      {formatMoney(d.amount)}
                    </TableCell>
                    <TableCell>
                      {voided ? (
                        <Badge variant="destructive" title={[d.voidedReason, auditText(d, names)].filter(Boolean).join(" — ")}>
                          Anulado
                        </Badge>
                      ) : (
                        <Badge variant="outline" title={auditText(d, names)}>Vigente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {d.type === "interno" && (
                          <Button variant="ghost" size="icon-sm" asChild aria-label="Descargar PDF">
                            <a href={`/api/comprobante/${d.id}`}>
                              <FileDown className="text-muted-foreground" />
                            </a>
                          </Button>
                        )}
                        {canEdit && !voided && (
                          <VoidDialog id={d.id} label={`${DOCUMENT_TYPE_LABELS[d.type]} ${number}`.trim()}>
                            <AuditInfo row={d} names={names} />
                          </VoidDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              {totals.map((t) => (
                <TableRow key={t.type}>
                  <TableCell colSpan={5}>
                    Total {DOCUMENT_TYPE_LABELS[t.type].toLowerCase()} ({t.count})
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(t.total)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              ))}
            </TableFooter>
          </Table>
        </div>
      )}
    </>
  );
}
