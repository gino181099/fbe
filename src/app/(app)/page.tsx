import Link from "next/link";
import { and, asc, count, desc, eq, gte, isNull, lte, ne } from "drizzle-orm";
import { CalendarDays } from "lucide-react";
import { ActivityList } from "@/components/activity-list";
import { MonthlyChart } from "@/components/monthly-chart";
import { EmptyState, PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { clients, collections, receipts, routes, trips, users } from "@/db/schema";
import { getActivities, getActivityLinkOptions } from "@/lib/activities";
import { getUserNames, getUsers } from "@/lib/audit";
import { getBalances, sumOf } from "@/lib/balances";
import { firstDayOfMonth, formatDate, formatMoney, today } from "@/lib/format";
import { buildMonthlySeries, formatMonth, resolveRange, totalsOf } from "@/lib/monthly";
import { can, requireUser } from "@/lib/permissions";
import { getMonthlyTotals, getTopRoutes } from "@/lib/reports";
import { cn } from "@/lib/utils";

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const canSales = can(user, "ventas");
  const canFinance = can(user, "finanzas");
  const canUsers = can(user, "usuarios");
  const end = today();
  const start = firstDayOfMonth(end);
  const month = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(
    new Date(`${start}T12:00:00`),
  );

  const sp = await searchParams;
  const desde = str(sp.desde);
  const hasta = str(sp.hasta);
  const clienteId = canSales || canFinance ? Number(str(sp.cliente)) || undefined : undefined;
  const hasFilters = Boolean(desde || hasta || clienteId);
  const range = resolveRange(desde, hasta, end);
  const period = `${formatMonth(range.months[0])} – ${formatMonth(range.months[range.months.length - 1])}`;

  // Mis actividades vencidas y de hoy (se piden en paralelo con el resto).
  const activitiesData = Promise.all([
    getActivities({ assignedTo: user.id, done: false, to: end }),
    getUsers(),
    getUserNames(),
    getActivityLinkOptions(),
  ]);
  const [[monthTrips], [monthCollected], recent, balances, clientRows, [pending], monthly, topRoutes] = await Promise.all([
    canSales
      ? db
          .select({ n: count(), total: sumOf(trips.price) })
          .from(trips)
          .where(and(gte(trips.date, start), lte(trips.date, end)))
      : [{ n: 0, total: 0 }],
    // Cobrado del mes = cobros históricos + recibos vigentes.
    canFinance
      ? Promise.all([
          db
            .select({ total: sumOf(collections.amount) })
            .from(collections)
            .where(and(eq(collections.kind, "cobro"), gte(collections.date, start), lte(collections.date, end))),
          db
            .select({ total: sumOf(receipts.amount) })
            .from(receipts)
            .where(and(isNull(receipts.voidedAt), gte(receipts.date, start), lte(receipts.date, end))),
        ]).then(([[c], [r]]) => [{ total: c.total + r.total }])
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
    canSales || canFinance
      ? db
          .select({ id: clients.id, name: clients.name })
          .from(clients)
          .where(ne(clients.type, "potencial"))
          .orderBy(asc(clients.name))
      : [],
    canUsers ? db.select({ n: count() }).from(users).where(eq(users.status, "pending")) : [{ n: 0 }],
    canSales || canFinance
      ? getMonthlyTotals(range.from, range.to, { sales: canSales, finance: canFinance }, clienteId)
      : { billed: null, collected: null, directCosts: null, generalExpenses: null },
    canSales ? getTopRoutes(range.from, range.to, clienteId) : [],
  ]);

  const clientName = clienteId ? clientRows.find((c) => c.id === clienteId)?.name : undefined;
  const monthlyRows = buildMonthlySeries(range.months, monthly);
  const monthlyTotals = totalsOf(monthlyRows);
  const hasMonthlyData = monthlyRows.some(
    (r) => (r.billed ?? 0) !== 0 || (r.collected ?? 0) !== 0 || (r.expenses ?? 0) !== 0,
  );
  const showGeneral = canFinance && !clienteId;
  const showExpenses = canSales || showGeneral;
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
  const [todayActivities, activityUsers, names, linkOptions] = await activitiesData;
  const overdueCount = todayActivities.filter((r) => r.activity.dueDate < end).length;

  return (
    <>
      <PageHeader title={`Hola${firstName ? `, ${firstName}` : ""}`} description={`Resumen de ${month}.`} />

      <section className="grid content-start gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-medium">Tus actividades de hoy</h2>
            <p className="text-sm text-muted-foreground">
              {todayActivities.length === 0
                ? "Nada pendiente para hoy."
                : [
                    todayActivities.length > overdueCount && `${todayActivities.length - overdueCount} para hoy`,
                    overdueCount > 0 && `${overdueCount} vencida${overdueCount === 1 ? "" : "s"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/agenda">
              <CalendarDays /> Ver agenda
            </Link>
          </Button>
        </div>
        <ActivityList
          rows={todayActivities}
          ctx={{
            users: activityUsers.map((u) => ({ id: u.id, name: u.name ?? u.username ?? "—" })),
            names,
            currentUserId: user.id,
            today: end,
            linkOptions,
          }}
          empty="No tenés actividades para hoy ni vencidas. ¡Todo al día!"
        />
      </section>

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
            <p className="text-sm text-muted-foreground">
              {period}
              {clientName && ` · ${clientName}`}
            </p>
          </div>
          <form key={`${range.from}|${range.to}|${clienteId ?? ""}`} className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Desde
              <Input type="date" name="desde" defaultValue={range.from} className="w-40" />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Hasta
              <Input type="date" name="hasta" defaultValue={range.to} className="w-40" />
            </label>
            <NativeSelect name="cliente" defaultValue={clienteId ?? ""}>
              <NativeSelectOption value="">Todos los clientes</NativeSelectOption>
              {clientRows.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button type="submit" variant="secondary">
              Filtrar
            </Button>
            {hasFilters && (
              <Button variant="ghost" asChild>
                <Link href="/">Limpiar</Link>
              </Button>
            )}
          </form>
          {clienteId && canSales && canFinance && (
            <p className="text-sm text-muted-foreground">
              Con un cliente elegido, Gastos incluye solo los costos directos de sus recorridos.
            </p>
          )}
          {!hasMonthlyData ? (
            <EmptyState>Sin movimientos en el período elegido.</EmptyState>
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
                      {canSales && <TableHead className="text-right">Costos directos</TableHead>}
                      {showGeneral && <TableHead className="text-right">Gastos generales</TableHead>}
                      {showExpenses && <TableHead className="text-right">Gastos</TableHead>}
                      {canSales && <TableHead className="text-right">Margen</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyRows.map((r) => (
                      <TableRow key={r.month}>
                        <TableCell>{formatMonth(r.month)}</TableCell>
                        {canSales && moneyCell(r.billed)}
                        {canFinance && moneyCell(r.collected)}
                        {canSales && moneyCell(r.directCosts)}
                        {showGeneral && moneyCell(r.generalExpenses)}
                        {showExpenses && moneyCell(r.expenses)}
                        {canSales && moneyCell(r.margin, true)}
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell>Total</TableCell>
                      {canSales && moneyCell(monthlyTotals.billed)}
                      {canFinance && moneyCell(monthlyTotals.collected)}
                      {canSales && moneyCell(monthlyTotals.directCosts)}
                      {showGeneral && moneyCell(monthlyTotals.generalExpenses)}
                      {showExpenses && moneyCell(monthlyTotals.expenses)}
                      {canSales && moneyCell(monthlyTotals.margin, true)}
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
            <h2 className="font-medium">
              Recorridos más vendidos ({period}){clientName && ` · ${clientName}`}
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/ventas">Ver recorridos</Link>
            </Button>
          </div>
          {topRoutes.length === 0 ? (
            <EmptyState>Sin recorridos en el período elegido.</EmptyState>
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
