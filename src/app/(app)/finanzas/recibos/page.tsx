import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { CheckCircle2, Download, FileDown, Plus } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { formatReceiptNumber } from "@/lib/doc-number";
import { formatDate, formatMoney } from "@/lib/format";
import { AuditInfo, auditText } from "@/components/audit-info";
import { getUserNames } from "@/lib/audit";
import { can, requirePermission } from "@/lib/permissions";
import { getReceipt, listReceipts } from "@/lib/receipts";
import { VoidReceiptDialog } from "./void-dialog";

export const metadata: Metadata = { title: "Recibos" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const STATUSES = ["vigentes", "anulados", "todos"] as const;

export default async function ReceiptsPage({ searchParams }: PageProps<"/finanzas/recibos">) {
  const user = await requirePermission("finanzas");
  const sp = await searchParams;
  const desde = isDate(str(sp.desde));
  const hasta = isDate(str(sp.hasta));
  const clienteId = Number(str(sp.cliente)) || undefined;
  const estado = STATUSES.find((s) => s === str(sp.estado)) ?? "vigentes";
  const nuevoId = Number(str(sp.nuevo)) || undefined;

  const [rows, clientList, created, names] = await Promise.all([
    listReceipts({ clientId: clienteId, from: desde, to: hasta, status: estado }),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
    nuevoId ? getReceipt(nuevoId) : null,
    getUserNames(),
  ]);
  const canEdit = can(user, "finanzas", "edit");
  // Los anulados no suman (salvo cuando se listan solo anulados).
  const counted = estado === "anulados" ? rows : rows.filter((r) => r.r.voidedAt == null);
  const total = counted.reduce((s, r) => s + r.r.amount, 0);
  const newHref = `/finanzas/recibos/nuevo${clienteId ? `?cliente=${clienteId}` : ""}`;

  return (
    <>
      <PageHeader help="recibos"
        title="Recibos"
        description="Pagos de clientes con recibo numerado. No se editan ni se borran: se anulan."
        actions={
          canEdit && (
            <Button asChild>
              <Link href={newHref}>
                <Plus /> Nuevo recibo
              </Link>
            </Button>
          )
        }
      />

      {created && (
        <Alert>
          <CheckCircle2 />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Recibo {formatReceiptNumber(created.number)} de {created.client.name} por {formatMoney(created.amount)}{" "}
              registrado.
            </span>
            <Button size="sm" asChild>
              <a href={`/api/recibo/${created.id}`}>
                <Download /> Descargar PDF
              </a>
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
        <NativeSelect name="estado" defaultValue={estado} aria-label="Estado">
          <NativeSelectOption value="vigentes">Vigentes</NativeSelectOption>
          <NativeSelectOption value="anulados">Anulados</NativeSelectOption>
          <NativeSelectOption value="todos">Todos</NativeSelectOption>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {(desde || hasta || clienteId || estado !== "vigentes") && (
          <Button variant="ghost" asChild>
            <Link href="/finanzas/recibos">Limpiar</Link>
          </Button>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState>No hay recibos con esos filtros.</EmptyState>
      ) : (
        <div className="surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Medio</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ r, clientName }) => {
                const voided = r.voidedAt != null;
                const number = formatReceiptNumber(r.number);
                return (
                  <TableRow key={r.id} className={voided ? "text-muted-foreground" : undefined}>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell className={`tabular-nums ${voided ? "line-through" : ""}`}>{number}</TableCell>
                    <TableCell>
                      <Link href={`/finanzas/cuentas/${r.clientId}`} className="hover:underline">
                        {clientName}
                      </Link>
                      {r.notes && <span className="block text-xs text-muted-foreground">{r.notes}</span>}
                    </TableCell>
                    <TableCell>{r.method ?? "—"}</TableCell>
                    <TableCell className={`text-right tabular-nums ${voided ? "line-through" : ""}`}>
                      {formatMoney(r.amount)}
                    </TableCell>
                    <TableCell>
                      {voided ? (
                        <Badge variant="destructive" title={[r.voidedReason, auditText(r, names)].filter(Boolean).join(" — ")}>
                          Anulado
                        </Badge>
                      ) : (
                        <Badge variant="outline" title={auditText(r, names)}>Vigente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon-sm" asChild aria-label="Descargar PDF">
                          <a href={`/api/recibo/${r.id}`}>
                            <FileDown className="text-muted-foreground" />
                          </a>
                        </Button>
                        {canEdit && !voided && (
                          <VoidReceiptDialog id={r.id} label={`recibo ${number}`}>
                            <AuditInfo row={r} names={names} />
                          </VoidReceiptDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>Total ({counted.length} recibos)</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(total)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </>
  );
}
