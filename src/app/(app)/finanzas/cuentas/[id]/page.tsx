import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { ArrowLeft, Download, Plus } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { getStatement } from "@/lib/balances";
import { CC_START, MOVEMENT_KIND_LABELS } from "@/lib/constants";
import { formatDate, formatMoney, today } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { saveCollection } from "../../actions";
import { CollectionFields } from "../../fields";

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

  const [data, clientList] = await Promise.all([
    getStatement(id, desde, hasta),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
  ]);
  if (!data) notFound();
  const query = new URLSearchParams({ desde: data.from, hasta });
  const tripsCount = data.lines.filter((l) => l.kind === "recorrido").length;
  const adjusted = data.totalCredit - data.totalCollected;

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
            {can(user, "finanzas", "edit") && (
              <FormDialog
                title="Registrar cobro"
                action={saveCollection.bind(null, null)}
                trigger={
                  <Button variant="outline">
                    <Plus /> Registrar cobro
                  </Button>
                }
              >
                <CollectionFields clients={clientList} defaultDate={today()} defaultClientId={id} />
              </FormDialog>
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
              <TableRow key={i}>
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
    </>
  );
}
