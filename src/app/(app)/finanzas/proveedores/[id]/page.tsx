import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { EmptyState, PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FUEL_SUPPLIER_CATEGORY } from "@/lib/constants";
import { formatDate, formatMoney, today } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { SUPPLIER_MOVEMENT_LABELS } from "@/lib/supplier-ledger";
import { getSupplierStatement } from "@/lib/suppliers";
import { deleteSupplierPayment, saveSupplierPayment } from "../../actions";
import { SupplierPaymentFields } from "../../fields";

export const metadata: Metadata = { title: "Cuenta del proveedor" };

const isDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function SupplierPage({ params, searchParams }: PageProps<"/finanzas/proveedores/[id]">) {
  const user = await requirePermission("finanzas");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;
  const desde = isDate(sp.desde);
  const hasta = isDate(sp.hasta);

  const data = await getSupplierStatement(id, desde, hasta);
  if (!data) notFound();
  const { supplier: s } = data;
  const canEdit = can(user, "finanzas", "edit");
  const isStation = s.category === FUEL_SUPPLIER_CATEGORY;
  const date = today();
  const paymentsById = new Map(data.payments.map((p) => [p.id, p]));
  const details = [s.category, s.cuit ? `CUIT ${s.cuit}` : null, s.invoices ? "Emite factura" : "Sin factura", s.active ? null : "Inactivo"]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/finanzas/proveedores">
          <ArrowLeft /> Proveedores
        </Link>
      </Button>
      <PageHeader
        title={s.name}
        description={details}
        actions={
          canEdit && (
            <FormDialog
              title="Registrar pago"
              description={`Pago a ${s.name}: baja el saldo general.`}
              action={saveSupplierPayment.bind(null, s.id, null)}
              trigger={
                <Button>
                  <Plus /> Registrar pago
                </Button>
              }
            >
              <SupplierPaymentFields defaultDate={date} />
            </FormDialog>
          )
        }
      />
      {s.notes && <p className="text-sm text-muted-foreground">{s.notes}</p>}

      <form className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Desde
          <Input type="date" name="desde" defaultValue={desde} className="w-40" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Hasta
          <Input type="date" name="hasta" defaultValue={hasta} className="w-40" />
        </label>
        <Button type="submit" variant="secondary">
          Ver período
        </Button>
        {(desde || hasta) && (
          <Button variant="ghost" asChild>
            <Link href={`/finanzas/proveedores/${s.id}`}>Todo</Link>
          </Button>
        )}
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Debe" value={formatMoney(data.totalDebit)} hint={desde ? `Desde el ${formatDate(desde)}` : "Todo el historial"} />
        <StatCard label="Pagado" value={formatMoney(data.totalCredit)} />
        <StatCard
          label={data.closing >= 0 ? "Saldo a pagar" : "Saldo a favor"}
          value={formatMoney(Math.abs(data.closing))}
          hint={hasta ? `Al ${formatDate(hasta)}` : undefined}
        />
      </div>

      {data.lines.length === 0 && !desde ? (
        <EmptyState>Este proveedor no tiene movimientos.</EmptyState>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="text-right">Haber</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                {canEdit && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {desde && (
                <TableRow className="text-muted-foreground">
                  <TableCell>{formatDate(desde)}</TableCell>
                  <TableCell />
                  <TableCell className="italic">Saldo anterior</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatMoney(data.opening)}</TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              )}
              {data.lines.map((l, i) => {
                const payment = l.kind === "pago" && l.refId ? paymentsById.get(l.refId) : undefined;
                return (
                  <TableRow key={i} className={l.info ? "text-muted-foreground" : undefined}>
                    <TableCell>{formatDate(l.date)}</TableCell>
                    <TableCell>
                      <Badge variant={l.kind === "pago" || l.kind === "pago_combustible" ? "secondary" : "outline"}>
                        {SUPPLIER_MOVEMENT_LABELS[l.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {l.description}
                      {l.info && <span className="ml-2 tabular-nums">({formatMoney(l.amount)}, no mueve el saldo)</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.debit ? formatMoney(l.debit) : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.credit ? formatMoney(l.credit) : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(l.balance)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        {payment && (
                          <div className="flex justify-end">
                            <FormDialog
                              title="Editar pago"
                              action={saveSupplierPayment.bind(null, s.id, payment.id)}
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label="Editar">
                                  <Pencil className="text-muted-foreground" />
                                </Button>
                              }
                            >
                              <SupplierPaymentFields
                                key={`${payment.id}-${payment.date}-${payment.amount}`}
                                value={payment}
                                defaultDate={date}
                              />
                            </FormDialog>
                            <ConfirmButton action={deleteSupplierPayment.bind(null, payment.id)} title="¿Eliminar pago?" />
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Debe: gastos a pagar{isStation ? ", gasoil de recorridos y cargas extras" : ""}. Haber: pagos
        {isStation ? " y gastos de categoría Combustible" : ""}. Los gastos contado se muestran pero no
        mueven el saldo.
      </p>
    </>
  );
}
