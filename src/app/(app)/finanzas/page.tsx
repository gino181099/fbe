import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { FileText } from "lucide-react";
import { ClientTypeBadge } from "@/components/badges";
import { PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { getBalances } from "@/lib/balances";
import { formatMoney } from "@/lib/format";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Cuentas corrientes" };

export default async function AccountsPage({ searchParams }: PageProps<"/finanzas">) {
  await requirePermission("finanzas");
  const showAll = (await searchParams).todos === "1";
  const [clientList, balances] = await Promise.all([db.select().from(clients).orderBy(asc(clients.name)), getBalances()]);

  const rows = clientList
    .map((c) => ({
      client: c,
      ...(balances.get(c.id) ?? { billed: 0, collected: 0, adjusted: 0, balance: 0, trips: 0 }),
    }))
    .filter((r) => showAll || Math.abs(r.balance) >= 0.01)
    .sort((a, b) => b.balance - a.balance);
  const totals = [...balances.values()].reduce(
    (acc, b) => ({
      billed: acc.billed + b.billed,
      collected: acc.collected + b.collected,
      adjusted: acc.adjusted + b.adjusted,
      balance: acc.balance + b.balance,
    }),
    { billed: 0, collected: 0, adjusted: 0, balance: 0 },
  );

  return (
    <>
      <PageHeader
        title="Cuentas corrientes"
        description="Cuenta corriente desde el 19/10/2026: recorridos, notas de débito y saldo inicial, menos cobros, ajustes, notas de crédito y bonificaciones."
        actions={
          <Button variant="outline" asChild>
            <Link href={showAll ? "/finanzas" : "/finanzas?todos=1"}>
              {showAll ? "Solo con saldo" : "Ver todos los clientes"}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total facturado" value={formatMoney(totals.billed)} />
        <StatCard label="Total cobrado" value={formatMoney(totals.collected)} />
        <StatCard label="Total ajustes" value={formatMoney(totals.adjusted)} />
        <StatCard label="Saldo a cobrar" value={formatMoney(totals.balance)} />
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Recorridos</TableHead>
              <TableHead className="text-right">Facturado</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="text-right">Ajustes</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.client.id}>
                <TableCell className="font-medium">{r.client.name}</TableCell>
                <TableCell>
                  <ClientTypeBadge type={r.client.type} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.trips}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(r.billed)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(r.collected)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(r.adjusted)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatMoney(r.balance)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/finanzas/cuentas/${r.client.id}`}>
                      <FileText /> Estado de cuenta
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
