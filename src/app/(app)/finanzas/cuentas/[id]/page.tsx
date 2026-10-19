import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronDown, Download, FileText, Plus } from "lucide-react";
import { EmptyState, PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStatement } from "@/lib/balances";
import { CC_START, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES, MOVEMENT_KIND_LABELS } from "@/lib/constants";
import { getUninvoicedTrips } from "@/lib/documents";
import { formatDate, formatMoney, today } from "@/lib/format";
import { tripDescription } from "@/lib/ledger";
import { can, requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Estado de cuenta" };

const isDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function StatementPage({ params, searchParams }: PageProps<"/finanzas/cuentas/[id]">) {
  const user = await requirePermission("finanzas");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;
  const hasta = isDate(sp.hasta) ?? today();
  // Por defecto: desde el 1/1 del año, pero nunca antes del inicio de la cuenta corriente.
  const yearStart = `${hasta.slice(0, 4)}-01-01`;
  const desde = isDate(sp.desde) ?? (yearStart < CC_START ? CC_START : yearStart);

  const [data, uninvoiced] = await Promise.all([getStatement(id, desde, hasta), getUninvoicedTrips(id)]);
  if (!data) notFound();
  const query = new URLSearchParams({ desde: data.from, hasta });
  const tripsCount = data.lines.filter((l) => l.kind === "recorrido").length;
  const adjusted = data.totalCredit - data.totalCollected;
  const canEdit = can(user, "finanzas", "edit");
  const uninvoicedTotal = uninvoiced.reduce((s, t) => s + t.price, 0);
  const pending = data.debits.filter((d) => d.status !== "cancelado");
  const pendingTotal = pending.reduce((s, d) => s + d.remaining, 0);
  const isInfo = (kind: string) => kind === "factura" || kind === "interno";

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/finanzas">
          <ArrowLeft /> Cuentas corrientes
        </Link>
      </Button>
      <PageHeader
        title={`Estado de cuenta · ${data.client.name}`}
        description={`Del ${formatDate(data.from)} al ${formatDate(hasta)} · cuenta corriente desde el ${formatDate(CC_START)}`}
        actions={
          <>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Plus /> Nuevo comprobante <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {DOCUMENT_TYPES.map((t) => (
                    <DropdownMenuItem key={t} asChild>
                      <Link href={`/finanzas/comprobantes/nuevo?cliente=${id}&tipo=${t}`}>{DOCUMENT_TYPE_LABELS[t]}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" asChild>
              <Link href={`/finanzas/comprobantes?cliente=${id}`}>
                <FileText /> Comprobantes
              </Link>
            </Button>
            {canEdit && (
              <Button variant="outline" asChild>
                <Link href={`/finanzas/recibos/nuevo?cliente=${id}`}>
                  <Plus /> Registrar recibo
                </Link>
              </Button>
            )}
            <Button asChild>
              <a href={`/api/estado-cuenta/${id}?${query}`}>
                <Download /> Descargar PDF
              </a>
            </Button>
          </>
        }
      />

      <form className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Desde
          <Input type="date" name="desde" defaultValue={data.from} min={CC_START} className="w-40" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Hasta
          <Input type="date" name="hasta" defaultValue={hasta} className="w-40" />
        </label>
        <Button type="submit" variant="secondary">
          Ver período
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Saldo anterior" value={formatMoney(data.opening)} hint={`Al ${formatDate(data.from)}`} />
        <StatCard label="Cargos del período" value={formatMoney(data.totalDebit)} hint={`${tripsCount} recorridos`} />
        <StatCard
          label="Cobrado en el período"
          value={formatMoney(data.totalCollected)}
          hint={Math.abs(adjusted) >= 0.01 ? `Ajustes y notas de crédito: ${formatMoney(adjusted)}` : undefined}
        />
        <StatCard
          label={data.closing >= 0 ? "Saldo a cobrar" : "Saldo a favor del cliente"}
          value={formatMoney(Math.abs(data.closing))}
        />
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead className="text-right">Debe</TableHead>
              <TableHead className="text-right">Haber</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="text-muted-foreground">
              <TableCell>{formatDate(data.from)}</TableCell>
              <TableCell className="italic">Saldo anterior</TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="text-right tabular-nums">{formatMoney(data.opening)}</TableCell>
            </TableRow>
            {data.lines.map((l, i) => (
              <TableRow key={i} className={isInfo(l.kind) ? "text-muted-foreground" : undefined}>
                <TableCell>{formatDate(l.date)}</TableCell>
                <TableCell>
                  {l.kind !== "recorrido" && (
                    <Badge variant="secondary" className="mr-2">
                      {MOVEMENT_KIND_LABELS[l.kind]}
                    </Badge>
                  )}
                  {l.description}
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.debit ? formatMoney(l.debit) : ""}</TableCell>
                <TableCell className="text-right tabular-nums">{l.credit ? formatMoney(l.credit) : ""}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(l.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Recorridos sin comprobante</h2>
        {uninvoiced.length === 0 ? (
          <EmptyState>Todos los recorridos desde el {formatDate(CC_START)} tienen factura o comprobante interno.</EmptyState>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uninvoiced.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDate(t.date)}</TableCell>
                    <TableCell>{tripDescription(t)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(t.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Total ({uninvoiced.length} recorridos)</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(uninvoicedTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Pendientes de cobro</h2>
        {pending.length === 0 ? (
          <EmptyState>No hay cargos pendientes de cobro.</EmptyState>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((d) => (
                  <TableRow key={d.key}>
                    <TableCell>{formatDate(d.date)}</TableCell>
                    <TableCell>
                      {d.kind !== "recorrido" && (
                        <Badge variant="secondary" className="mr-2">
                          {MOVEMENT_KIND_LABELS[d.kind]}
                        </Badge>
                      )}
                      {d.description}
                    </TableCell>
                    <TableCell>{formatDate(d.dueDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.paid ? formatMoney(d.paid) : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.remaining)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>Total pendiente</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(pendingTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </section>
    </>
  );
}
