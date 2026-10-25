import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gte, isNotNull, lte, type SQL, sql } from "drizzle-orm";
import { Pencil, Plus } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { AuditInfo } from "@/components/audit-info";
import { EmptyState, PageHeader, StatCard } from "@/components/page-header";
import { getUserNames } from "@/lib/audit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { drivers, EXPENSE_CATEGORIES, EXPENSE_SCOPES, expenses, fuelLoads, supplierPayments, suppliers, trips, vehicles } from "@/db/schema";
import { sumOf } from "@/lib/balances";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_SCOPE_LABELS,
  type ExpenseCategory,
  FUEL_SUPPLIER_CATEGORY,
  VOUCHER_TYPE_LABELS,
} from "@/lib/constants";
import { formatDate, formatMoney, formatNumber, today } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { deleteExpense, deleteFuelLoad, saveExpense, saveFuelLoad } from "../actions";
import { ExpenseFields, FuelLoadFields } from "../fields";

export const metadata: Metadata = { title: "Gastos" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const sumBy = (rows: { total: number }[]) => rows.reduce((s, r) => s + r.total, 0);

export default async function ExpensesPage({ searchParams }: PageProps<"/finanzas/gastos">) {
  const user = await requirePermission("finanzas");
  const sp = await searchParams;
  const desde = isDate(str(sp.desde));
  const hasta = isDate(str(sp.hasta));
  const categoria = EXPENSE_CATEGORIES.find((c) => c === sp.categoria);
  const alcance = EXPENSE_SCOPES.find((s) => s === sp.alcance);
  const estado = (["contado", "a_pagar"] as const).find((s) => s === sp.estado);
  const vehiculo = Number(str(sp.vehiculo)) || undefined;
  const proveedor = Number(str(sp.proveedor)) || undefined;

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
  // Filtros de la tabla (los totales por categoría solo usan el período).
  const rowFilters = [...expFilters];
  if (categoria) rowFilters.push(eq(expenses.category, categoria));
  if (alcance) rowFilters.push(eq(expenses.scope, alcance));
  if (vehiculo) rowFilters.push(eq(expenses.vehicleId, vehiculo));
  if (proveedor) rowFilters.push(eq(expenses.supplierId, proveedor));
  if (estado) rowFilters.push(eq(expenses.paid, estado === "contado"));

  const payFilters: SQL[] = [];
  if (desde) payFilters.push(gte(supplierPayments.date, desde));
  if (hasta) payFilters.push(lte(supplierPayments.date, hasta));
  const stationName = sql<string | null>`coalesce(${suppliers.name}, ${expenses.supplier})`;

  const [
    expenseRows,
    byCategory,
    loads,
    tripFuel,
    fuelPayments,
    supplierPaid,
    conceptRows,
    subcategoryRows,
    driverList,
    vehicleList,
    supplierList,
    names,
  ] = await Promise.all([
    db
      .select({ expense: expenses, vehiclePlate: vehicles.plate, supplierName: suppliers.name })
      .from(expenses)
      .leftJoin(vehicles, eq(vehicles.id, expenses.vehicleId))
      .leftJoin(suppliers, eq(suppliers.id, expenses.supplierId))
      .where(and(...rowFilters))
      .orderBy(desc(expenses.date), desc(expenses.id))
      .limit(500),
    db
      .select({ category: expenses.category, paid: expenses.paid, total: sumOf(expenses.amount) })
      .from(expenses)
      .where(and(...expFilters))
      .groupBy(expenses.category, expenses.paid),
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
    // Pagos a estación: gastos de combustible (por proveedor vinculado o, si no, el texto) + pagos a
    // proveedor (T-021). Mismo criterio que la cuenta del proveedor.
    db
      .select({ supplier: stationName, total: sumOf(expenses.amount) })
      .from(expenses)
      .leftJoin(suppliers, eq(suppliers.id, expenses.supplierId))
      .where(and(...expFilters, eq(expenses.category, "combustible")))
      .groupBy(stationName),
    db
      .select({ supplier: suppliers.name, category: suppliers.category, total: sumOf(supplierPayments.amount) })
      .from(supplierPayments)
      .innerJoin(suppliers, eq(suppliers.id, supplierPayments.supplierId))
      .where(and(...payFilters))
      .groupBy(suppliers.name, suppliers.category),
    db.selectDistinct({ concept: expenses.concept }).from(expenses).where(isNotNull(expenses.concept)).orderBy(asc(expenses.concept)),
    db
      .selectDistinct({ subcategory: expenses.subcategory })
      .from(expenses)
      .where(isNotNull(expenses.subcategory))
      .orderBy(asc(expenses.subcategory)),
    db.select({ id: drivers.id, name: drivers.name, active: drivers.active }).from(drivers).orderBy(asc(drivers.name)),
    db
      .select({ id: vehicles.id, plate: vehicles.plate, model: vehicles.model, active: vehicles.active })
      .from(vehicles)
      .orderBy(asc(vehicles.plate)),
    db.select({ id: suppliers.id, name: suppliers.name, active: suppliers.active }).from(suppliers).orderBy(asc(suppliers.name)),
    getUserNames(),
  ]);
  const fleet = { drivers: driverList, vehicles: vehicleList };

  const canEdit = can(user, "finanzas", "edit");
  const date = today();
  const concepts = conceptRows.map((c) => c.concept!);
  const subcategories = subcategoryRows.map((c) => c.subcategory!);
  const catTotal = (c: ExpenseCategory) => sumBy(byCategory.filter((b) => b.category === c));
  const totalExpenses = sumBy(byCategory);
  const toPay = sumBy(byCategory.filter((b) => !b.paid));
  const formProps = { defaultDate: date, concepts, subcategories, fleet, supplierOptions: supplierList };

  // Combustible por estación: consumo (gasoil de recorridos + cargas extras) contra pagos. Se agrupa por
  // nombre sin mayúsculas ni espacios extremos (mismo criterio que la cuenta del proveedor).
  const stations = new Map<string, { name: string; trips: number; liters: number; loads: number; paid: number }>();
  const stationKey = (name: string | null) => name?.trim().toLowerCase() || "";
  const station = (name: string | null) => {
    const key = stationKey(name);
    if (!stations.has(key)) stations.set(key, { name: name?.trim() || "Sin especificar", trips: 0, liters: 0, loads: 0, paid: 0 });
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
  // Pagos a proveedor: solo de estaciones (rubro Combustible o con consumo/pagos en la tabla).
  for (const p of supplierPaid)
    if (stations.has(stationKey(p.supplier)) || p.category === FUEL_SUPPLIER_CATEGORY) station(p.supplier).paid += p.total;
  const stationRows = [...stations.values()].sort((a, b) => a.name.localeCompare(b.name));
  const fuelTotals = stationRows.reduce(
    (acc, s) => ({ consumption: acc.consumption + s.trips + s.loads, paid: acc.paid + s.paid }),
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
                <ExpenseFields {...formProps} />
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
        <NativeSelect name="alcance" defaultValue={alcance ?? ""}>
          <NativeSelectOption value="">Todo alcance</NativeSelectOption>
          {EXPENSE_SCOPES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {EXPENSE_SCOPE_LABELS[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="categoria" defaultValue={categoria ?? ""}>
          <NativeSelectOption value="">Todas las categorías</NativeSelectOption>
          {EXPENSE_CATEGORIES.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {EXPENSE_CATEGORY_LABELS[c]}
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
        <NativeSelect name="proveedor" defaultValue={proveedor ?? ""}>
          <NativeSelectOption value="">Todos los proveedores</NativeSelectOption>
          {supplierList.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {s.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="estado" defaultValue={estado ?? ""}>
          <NativeSelectOption value="">Contado y a pagar</NativeSelectOption>
          <NativeSelectOption value="contado">Contado</NativeSelectOption>
          <NativeSelectOption value="a_pagar">A pagar</NativeSelectOption>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {(desde || hasta || categoria || alcance || vehiculo || proveedor || estado) && (
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-6">
            <StatCard label="Total" value={formatMoney(totalExpenses)} />
            {EXPENSE_CATEGORIES.map((c) => (
              <StatCard key={c} label={EXPENSE_CATEGORY_LABELS[c]} value={formatMoney(catTotal(c))} />
            ))}
            <StatCard label="A pagar" value={formatMoney(toPay)} />
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
                    <TableHead>Qué / para qué</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Comprobante</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    {canEdit && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseRows.map(({ expense: e, vehiclePlate, supplierName }) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(e.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{EXPENSE_CATEGORY_LABELS[e.category]}</Badge>
                        {e.subcategory && <span className="block text-xs text-muted-foreground">{e.subcategory}</span>}
                      </TableCell>
                      <TableCell>
                        {e.concept ?? "—"}
                        {e.purpose && <span className="block text-xs text-muted-foreground">Para: {e.purpose}</span>}
                        {e.notes && <span className="block text-xs text-muted-foreground">{e.notes}</span>}
                      </TableCell>
                      <TableCell>
                        {supplierName && e.supplierId ? (
                          <Link href={`/finanzas/proveedores/${e.supplierId}`} className="hover:underline">
                            {supplierName}
                          </Link>
                        ) : (
                          (e.supplier ?? "—")
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {e.voucherType === "sin_comprobante" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <>
                            {VOUCHER_TYPE_LABELS[e.voucherType]}
                            {e.voucherNumber && <span className="block text-xs text-muted-foreground">{e.voucherNumber}</span>}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{vehiclePlate ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={e.paid ? "secondary" : "destructive"}>{e.paid ? "Contado" : "A pagar"}</Badge>
                      </TableCell>
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
                              <ExpenseFields value={e} {...formProps} />
                              <AuditInfo row={e} names={names} />
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
                    <TableCell colSpan={7}>Total</TableCell>
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
                {stationRows.map((s) => {
                  const balance = s.trips + s.loads - s.paid;
                  return (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
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
            Saldo positivo: combustible consumido todavía no pagado a la estación. Los pagos se registran desde la
            cuenta de la estación en <Link href="/finanzas/proveedores" className="underline">Proveedores</Link> (los
            gastos de categoría Combustible ya cargados siguen contando como pagos).
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
                              <AuditInfo row={l} names={names} />
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
