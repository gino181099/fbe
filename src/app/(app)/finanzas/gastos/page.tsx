import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gte, isNotNull, lte, type SQL } from "drizzle-orm";
import { Pencil, Plus } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { EmptyState, PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { drivers, EXPENSE_CATEGORIES, expenses, fuelLoads, trips, vehicles } from "@/db/schema";
import { sumOf } from "@/lib/balances";
import { formatDate, formatMoney, formatNumber, today } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { deleteExpense, deleteFuelLoad, saveExpense, saveFuelLoad } from "../actions";
import { EXPENSE_LABELS, ExpenseFields, FuelLoadFields } from "../fields";

export const metadata: Metadata = { title: "Gastos" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function ExpensesPage({ searchParams }: PageProps<"/finanzas/gastos">) {
  const user = await requirePermission("finanzas");
  const sp = await searchParams;
  const desde = isDate(str(sp.desde));
  const hasta = isDate(str(sp.hasta));
  const categoria = EXPENSE_CATEGORIES.find((c) => c === sp.categoria);
  const vehiculo = Number(str(sp.vehiculo)) || undefined;

  const expFilters: SQL[] = [];
  const fuelFilters: SQL[] = [];
  const tripFilters: SQL[] = [];
  if (desde) {
    expFilters.push(gte(expenses.date, desde));
    fuelFilters.push(gte(fuelLoads.date, desde));
    tripFilters.push(gte(trips.date, desde));
  }
  if (hasta) {
    expFilters.push(lte(expenses.date, hasta));
    fuelFilters.push(lte(fuelLoads.date, hasta));
    tripFilters.push(lte(trips.date, hasta));
  }
  const categoryFilters = categoria ? [...expFilters, eq(expenses.category, categoria)] : [...expFilters];
  if (vehiculo) categoryFilters.push(eq(expenses.vehicleId, vehiculo));

  const [expenseRows, byCategory, loads, tripFuel, fuelPayments, conceptRows, driverList, vehicleList] = await Promise.all([
    db
      .select({ expense: expenses, vehiclePlate: vehicles.plate })
      .from(expenses)
      .leftJoin(vehicles, eq(vehicles.id, expenses.vehicleId))
      .where(and(...categoryFilters))
      .orderBy(desc(expenses.date), desc(expenses.id))
      .limit(500),
    db
      .select({ category: expenses.category, total: sumOf(expenses.amount) })
      .from(expenses)
      .where(and(...expFilters))
      .groupBy(expenses.category),
    db
      .select()
      .from(fuelLoads)
      .where(and(...fuelFilters))
      .orderBy(desc(fuelLoads.date), desc(fuelLoads.id)),
    db
      .select({ supplier: trips.fuelSupplier, pesos: sumOf(trips.fuelPesos), liters: sumOf(trips.fuelLiters) })
      .from(trips)
      .where(and(...tripFilters))
      .groupBy(trips.fuelSupplier),
    db
      .select({ supplier: expenses.supplier, total: sumOf(expenses.amount) })
      .from(expenses)
      .where(and(...expFilters, eq(expenses.category, "combustible")))
      .groupBy(expenses.supplier),
    db.selectDistinct({ concept: expenses.concept }).from(expenses).where(isNotNull(expenses.concept)).orderBy(asc(expenses.concept)),
    db.select({ id: drivers.id, name: drivers.name, active: drivers.active }).from(drivers).orderBy(asc(drivers.name)),
    db
      .select({ id: vehicles.id, plate: vehicles.plate, model: vehicles.model, active: vehicles.active })
      .from(vehicles)
      .orderBy(asc(vehicles.plate)),
  ]);
  const fleet = { drivers: driverList, vehicles: vehicleList };

  const canEdit = can(user, "finanzas", "edit");
  const date = today();
  const concepts = conceptRows.map((c) => c.concept!);
  const catTotal = (c: (typeof EXPENSE_CATEGORIES)[number]) => byCategory.find((b) => b.category === c)?.total ?? 0;
  const totalExpenses = byCategory.reduce((s, b) => s + b.total, 0);

  // Combustible por estación: consumo (gasoil de recorridos + cargas extras) contra pagos.
  const stations = new Map<string, { trips: number; liters: number; loads: number; paid: number }>();
  const station = (name: string | null) => {
    const key = name ?? "Sin especificar";
    if (!stations.has(key)) stations.set(key, { trips: 0, liters: 0, loads: 0, paid: 0 });
    return stations.get(key)!;
  };
  for (const t of tripFuel) {
    if (!t.pesos && !t.liters) continue;
    station(t.supplier).trips += t.pesos;
    station(t.supplier).liters += t.liters;
  }
  for (const l of loads) {
    station(l.supplier).loads += l.pesos;
    station(l.supplier).liters += l.liters ?? 0;
  }
  for (const p of fuelPayments) station(p.supplier).paid += p.total;
  const stationRows = [...stations.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const fuelTotals = stationRows.reduce(
    (acc, [, s]) => ({ consumption: acc.consumption + s.trips + s.loads, paid: acc.paid + s.paid }),
    { consumption: 0, paid: 0 },
  );

  return (
    <>
      <PageHeader
        title="Gastos"
        description="Pagos realizados y control de combustible."
        actions={
          canEdit && (
            <>
              <FormDialog
                title="Registrar carga de combustible"
                description="Cargas que no corresponden a un recorrido puntual."
                action={saveFuelLoad.bind(null, null)}
                trigger={<Button variant="outline">Carga de combustible</Button>}
              >
                <FuelLoadFields defaultDate={date} />
              </FormDialog>
              <FormDialog
                title="Registrar gasto"
                action={saveExpense.bind(null, null)}
                trigger={
                  <Button>
                    <Plus /> Registrar gasto
                  </Button>
                }
              >
                <ExpenseFields defaultDate={date} concepts={concepts} fleet={fleet} />
              </FormDialog>
            </>
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
        <NativeSelect name="categoria" defaultValue={categoria ?? ""}>
          <NativeSelectOption value="">Todas las categorías</NativeSelectOption>
          {EXPENSE_CATEGORIES.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {EXPENSE_LABELS[c]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="vehiculo" defaultValue={vehiculo ?? ""}>
          <NativeSelectOption value="">Todos los vehículos</NativeSelectOption>
          {vehicleList.map((v) => (
            <NativeSelectOption key={v.id} value={v.id}>
              {v.plate}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {(desde || hasta || categoria || vehiculo) && (
          <Button variant="ghost" asChild>
            <Link href="/finanzas/gastos">Limpiar</Link>
          </Button>
        )}
      </form>

      <Tabs defaultValue="gastos">
        <TabsList>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="combustible">Combustible</TabsTrigger>
        </TabsList>

        <TabsContent value="gastos" className="grid gap-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Total" value={formatMoney(totalExpenses)} />
            {EXPENSE_CATEGORIES.map((c) => (
              <StatCard key={c} label={EXPENSE_LABELS[c]} value={formatMoney(catTotal(c))} />
            ))}
          </div>
          {expenseRows.length === 0 ? (
            <EmptyState>No hay gastos con esos filtros.</EmptyState>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Observaciones</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    {canEdit && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseRows.map(({ expense: e, vehiclePlate }) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{EXPENSE_LABELS[e.category]}</Badge>
                      </TableCell>
                      <TableCell>
                        {e.concept ?? "—"}
                        {e.supplier && <span className="block text-xs text-muted-foreground">{e.supplier}</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{vehiclePlate ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.notes ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(e.amount)}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex justify-end">
                            <FormDialog
                              title="Editar gasto"
                              action={saveExpense.bind(null, e.id)}
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label="Editar">
                                  <Pencil className="text-muted-foreground" />
                                </Button>
                              }
                            >
                              <ExpenseFields value={e} defaultDate={date} concepts={concepts} fleet={fleet} />
                            </FormDialog>
                            <ConfirmButton action={deleteExpense.bind(null, e.id)} title="¿Eliminar gasto?" />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5}>Total</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(expenseRows.reduce((s, r) => s + r.expense.amount, 0))}
                    </TableCell>
                    {canEdit && <TableCell />}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="combustible" className="grid gap-4 pt-2">
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estación</TableHead>
                  <TableHead className="text-right">Litros</TableHead>
                  <TableHead className="text-right">Gasoil en recorridos</TableHead>
                  <TableHead className="text-right">Cargas extras</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stationRows.map(([name, s]) => {
                  const balance = s.trips + s.loads - s.paid;
                  return (
                    <TableRow key={name}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(s.liters)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(s.trips)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(s.loads)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(s.paid)}</TableCell>
                      <TableCell
                        className="text-right font-medium tabular-nums"
                        title={balance > 0 ? "Consumido y no pagado" : "Pagado de más / por adelantado"}
                      >
                        {formatMoney(balance)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Total consumido {formatMoney(fuelTotals.consumption)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(fuelTotals.paid)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(fuelTotals.consumption - fuelTotals.paid)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Saldo positivo: combustible consumido todavía no pagado a la estación. Los pagos se registran como gastos
            de categoría Combustible indicando la estación.
          </p>
          <h2 className="mt-2 text-sm font-medium">Cargas extras (no asociadas a un recorrido)</h2>
          {loads.length === 0 ? (
            <EmptyState>No hay cargas extras en el período.</EmptyState>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Observaciones</TableHead>
                    <TableHead className="text-right">Litros</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    {canEdit && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{formatDate(l.date)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[l.supplier, l.notes].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(l.liters)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(l.pesos)}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex justify-end">
                            <FormDialog
                              title="Editar carga"
                              action={saveFuelLoad.bind(null, l.id)}
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label="Editar">
                                  <Pencil className="text-muted-foreground" />
                                </Button>
                              }
                            >
                              <FuelLoadFields value={l} defaultDate={date} />
                            </FormDialog>
                            <ConfirmButton action={deleteFuelLoad.bind(null, l.id)} title="¿Eliminar carga?" />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
