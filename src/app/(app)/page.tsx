import Link from "next/link";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { MonthlyChart } from "@/components/monthly-chart";
import { EmptyState, PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { clients, collections, routes, trips, users } from "@/db/schema";
import { getBalances, sumOf } from "@/lib/balances";
import { firstDayOfMonth, formatDate, formatMoney, today } from "@/lib/format";
import { buildMonthlySeries, formatMonth, lastMonths, totalsOf } from "@/lib/monthly";
import { can, requireUser } from "@/lib/permissions";
import { getMonthlyTotals, getTopRoutes } from "@/lib/reports";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const canSales = can(user, "ventas");
  const canFinance = can(user, "finanzas");
  const canUsers = can(user, "usuarios");
  const end = today();
  const start = firstDayOfMonth(end);
  const month = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(
    new Date(`${start}T12:00:00`),
  );

  const months = lastMonths(end);
  const periodStart = `${months[0]}-01`;

  const [[monthTrips], [monthCollected], recent, balances, clientRows, [pending], monthly, topRoutes] = await Promise.all([
    canSales
      ? db
          .select({ n: count(), total: sumOf(trips.price) })
          .from(trips)
          .where(and(gte(trips.date, start), lte(trips.date, end)))
      : [{ n: 0, total: 0 }],
    canFinance
      ? db
          .select({ total: sumOf(collections.amount) })
          .from(collections)
          .where(and(eq(collections.kind, "cobro"), gte(collections.date, start), lte(collections.date, end)))
      : [{ total: 0 }],
    canSales
      ? db
          .select({
            id: trips.id,
            date: trips.date,
            client: clients.name,
            route: routes.name,
            routeText: trips.routeText,
            price: trips.price,
          })
          .from(trips)
          .innerJoin(clients, eq(clients.id, trips.clientId))
          .leftJoin(routes, eq(routes.id, trips.routeId))
          .orderBy(desc(trips.date), desc(trips.id))
          .limit(8)
      : [],
    canFinance ? getBalances() : new Map<number, { balance: number }>(),
    canFinance ? db.select({ id: clients.id, name: clients.name }).from(clients) : [],
    canUsers ? db.select({ n: count() }).from(users).where(eq(users.status, "pending")) : [{ n: 0 }],
    canSales || canFinance
      ? getMonthlyTotals(periodStart, end, { sales: canSales, finance: canFinance })
      : { billed: null, collected: null, expenses: null },
    canSales ? getTopRoutes(periodStart, end) : [],
  ]);

  const monthlyRows = buildMonthlySeries(months, monthly);
  const monthlyTotals = totalsOf(monthlyRows);
  const hasMonthlyData = monthlyRows.some(
    (r) => (r.billed ?? 0) !== 0 || (r.collected ?? 0) !== 0 || (r.expenses ?? 0) !== 0,
  );
  const moneyCell = (v: number | null, negative = false) => (
    <TableCell className={cn("text-right tabular-nums", negative && v != null && v < 0 && "text-destructive")}>
      {formatMoney(v)}
    </TableCell>
  );

  const debtors = clientRows
    .map((c) => ({ ...c, balance: balances.get(c.id)?.balance ?? 0 }))
    .filter((c) => c.balance > 0.01)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);
  const totalOwed = [...balances.values()].reduce((s, b) => s + b.balance, 0);
  const firstName = (user.name ?? user.username ?? "").split(" ")[0];

  return (
    <>
      <PageHeader title={`Hola${firstName ? `, ${firstName}` : ""}`} description={`Resumen de ${month}.`} />

      {canUsers && pending.n > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <span>
            Hay {pending.n} {pending.n === 1 ? "usuario esperando" : "usuarios esperando"} aprobación.
          </span>
          <Button size="sm" asChild>
            <Link href="/usuarios">Revisar</Link>
          </Button>
        </div>
      )}

      {(canSales || canFinance) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {canSales && <StatCard label="Recorridos del mes" value={monthTrips.n} />}
          {canSales && <StatCard label="Facturado del mes" value={formatMoney(monthTrips.total)} />}
          {canFinance && <StatCard label="Cobrado del mes" value={formatMoney(monthCollected.total)} />}
          {canFinance && <StatCard label="Saldo total a cobrar" value={formatMoney(totalOwed)} />}
        </div>
      )}

      {(canSales || canFinance) && (
        <section className="grid content-start gap-3">
          <div>
            <h2 className="font-medium">Evolución mensual</h2>
            <p className="text-sm text-muted-foreground">Últimos 12 meses</p>
          </div>
          {!hasMonthlyData ? (
            <EmptyState>Sin movimientos en los últimos 12 meses.</EmptyState>
          ) : (
            <>
              <div className="rounded-xl border p-4">
                <MonthlyChart rows={monthlyRows} />
              </div>
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      {canSales && <TableHead className="text-right">Facturado</TableHead>}
                      {canFinance && <TableHead className="text-right">Cobrado</TableHead>}
                      {canFinance && <TableHead className="text-right">Gastos</TableHead>}
                      {canSales && canFinance && <TableHead className="text-right">Margen</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyRows.map((r) => (
                      <TableRow key={r.month}>
                        <TableCell>{formatMonth(r.month)}</TableCell>
                        {canSales && moneyCell(r.billed)}
                        {canFinance && moneyCell(r.collected)}
                        {canFinance && moneyCell(r.expenses)}
                        {canSales && canFinance && moneyCell(r.margin, true)}
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell>Total</TableCell>
                      {canSales && moneyCell(monthlyTotals.billed)}
                      {canFinance && moneyCell(monthlyTotals.collected)}
                      {canFinance && moneyCell(monthlyTotals.expenses)}
                      {canSales && canFinance && moneyCell(monthlyTotals.margin, true)}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </section>
      )}

      {canSales && (
        <section className="grid content-start gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Recorridos más vendidos (últimos 12 meses)</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/ventas">Ver recorridos</Link>
            </Button>
          </div>
          {topRoutes.length === 0 ? (
            <EmptyState>Sin recorridos en los últimos 12 meses.</EmptyState>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recorrido</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Facturado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topRoutes.map((t) => (
                    <TableRow key={t.name}>
                      <TableCell>{t.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.n}</TableCell>
                      {moneyCell(t.total)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {canSales && (
          <section className="grid content-start gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Últimos recorridos</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/ventas">Ver todos</Link>
              </Button>
            </div>
            {recent.length === 0 ? (
              <EmptyState>Sin recorridos.</EmptyState>
            ) : (
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Recorrido</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{formatDate(t.date)}</TableCell>
                        <TableCell>{t.client}</TableCell>
                        <TableCell>{t.route ?? t.routeText ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(t.price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        )}
        {canFinance && (
          <section className="grid content-start gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Clientes con mayor saldo</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/finanzas">Cuentas corrientes</Link>
              </Button>
            </div>
            {debtors.length === 0 ? (
              <EmptyState>No hay saldos pendientes.</EmptyState>
            ) : (
              <div className="rounded-xl border">
                <Table>
                  <TableBody>
                    {debtors.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Link href={`/finanzas/cuentas/${d.id}`} className="hover:underline">
                            {d.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatMoney(d.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        )}
      </div>

      {!canSales && !canFinance && !can(user, "contactos") && (
        <EmptyState>Todavía no tenés permisos asignados en ningún módulo. Pedile acceso al administrador.</EmptyState>
      )}
    </>
  );
}
