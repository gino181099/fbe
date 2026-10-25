import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, gte, isNotNull, lte, ne } from "drizzle-orm";
import { Pencil, Plus, Power } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { drivers, expenses, trips, vehicles } from "@/db/schema";
import { sumOf } from "@/lib/balances";
import { AuditInfo } from "@/components/audit-info";
import { getUserNames } from "@/lib/audit";
import { addDays, firstDayOfMonth, formatMoney } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import {
  deleteDriver,
  deleteVehicle,
  saveDriver,
  saveVehicle,
  toggleDriver,
  toggleVehicle,
} from "./actions";
import { DriverFields } from "./driver-form";
import { VehicleFields } from "./vehicle-form";

export const metadata: Metadata = { title: "Flota" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function FleetPage({ searchParams }: PageProps<"/flota">) {
  const user = await requirePermission("ventas");
  const sp = await searchParams;
  const monthStart = firstDayOfMonth();
  const desde = isDate(str(sp.desde)) ?? monthStart;
  const hasta = isDate(str(sp.hasta)) ?? addDays(firstDayOfMonth(addDays(monthStart, 32)), -1);
  const tripPeriod = and(gte(trips.date, desde), lte(trips.date, hasta));

  const [vehicleList, driverList, byVehicle, vehicleExpenses, byDriver, names] = await Promise.all([
    db.select().from(vehicles).orderBy(asc(vehicles.plate)),
    db.select().from(drivers).orderBy(asc(drivers.name)),
    db
      .select({
        id: trips.vehicleId,
        n: count(),
        billed: sumOf(trips.price),
        fuel: sumOf(trips.fuelPesos),
        driverPay: sumOf(trips.driverPay),
        extra: sumOf(trips.extraPayments),
      })
      .from(trips)
      .where(and(tripPeriod, isNotNull(trips.vehicleId)))
      .groupBy(trips.vehicleId),
    db
      .select({ id: expenses.vehicleId, total: sumOf(expenses.amount) })
      .from(expenses)
      // Gastos del vehículo sin combustible (el pago a estación ya está en la columna Gasoil).
      .where(
        and(
          gte(expenses.date, desde),
          lte(expenses.date, hasta),
          eq(expenses.scope, "vehiculo"),
          ne(expenses.category, "combustible"),
        ),
      )
      .groupBy(expenses.vehicleId),
    db
      .select({ id: trips.driverId, n: count(), driverPay: sumOf(trips.driverPay) })
      .from(trips)
      .where(and(tripPeriod, isNotNull(trips.driverId)))
      .groupBy(trips.driverId),
    getUserNames(),
  ]);

  const canEdit = can(user, "ventas", "edit");
  const showMoney = can(user, "finanzas", "view");
  const vehicleStats = new Map(byVehicle.map((v) => [v.id, v]));
  const expenseStats = new Map(vehicleExpenses.map((e) => [e.id, e.total]));
  const driverStats = new Map(byDriver.map((d) => [d.id, d]));

  return (
    <>
      <PageHeader
        title="Flota"
        description="Choferes, vehículos y costos por unidad"
        actions={
          canEdit && (
            <>
              <FormDialog
                title="Nuevo chofer"
                action={saveDriver.bind(null, null)}
                trigger={
                  <Button variant="outline">
                    <Plus /> Nuevo chofer
                  </Button>
                }
              >
                <DriverFields />
              </FormDialog>
              <FormDialog
                title="Nuevo vehículo"
                action={saveVehicle.bind(null, null)}
                trigger={
                  <Button>
                    <Plus /> Nuevo vehículo
                  </Button>
                }
              >
                <VehicleFields />
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
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <h2 className="text-lg font-medium">Vehículos</h2>
      {vehicleList.length === 0 ? (
        <EmptyState>No hay vehículos cargados.</EmptyState>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patente</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead className="text-right">Plazas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Recorridos</TableHead>
                {showMoney && (
                  <>
                    <TableHead className="text-right">Facturado</TableHead>
                    <TableHead className="text-right">Gasoil</TableHead>
                    <TableHead className="text-right">Choferes</TableHead>
                    <TableHead className="text-right" title="Gastos del vehículo + pagos adicionales de sus recorridos">
                      Gastos
                    </TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                  </>
                )}
                {canEdit && <TableHead className="w-28" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicleList.map((v) => {
                const s = vehicleStats.get(v.id);
                const exp = (expenseStats.get(v.id) ?? 0) + (s?.extra ?? 0);
                const billed = s?.billed ?? 0;
                const fuel = s?.fuel ?? 0;
                const pay = s?.driverPay ?? 0;
                return (
                  <TableRow key={v.id} className={v.active ? undefined : "text-muted-foreground"}>
                    <TableCell className="font-medium">{v.plate}</TableCell>
                    <TableCell>
                      {v.model}
                      {v.notes && <span className="block text-xs text-muted-foreground">{v.notes}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{v.seats}</TableCell>
                    <TableCell>
                      <Badge variant={v.active ? "secondary" : "outline"}>{v.active ? "Activo" : "Inactivo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s?.n ?? 0}</TableCell>
                    {showMoney && (
                      <>
                        <TableCell className="text-right tabular-nums">{formatMoney(billed)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(fuel)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(pay)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <Link
                            href={`/finanzas/gastos?vehiculo=${v.id}&desde=${desde}&hasta=${hasta}`}
                            className="hover:underline"
                            title="Ver los gastos del vehículo"
                          >
                            {formatMoney(exp)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(billed - fuel - pay - exp)}
                        </TableCell>
                      </>
                    )}
                    {canEdit && (
                      <TableCell>
                        <div className="flex justify-end">
                          <FormDialog
                            title="Editar vehículo"
                            action={saveVehicle.bind(null, v.id)}
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label="Editar">
                                <Pencil className="text-muted-foreground" />
                              </Button>
                            }
                          >
                            <VehicleFields value={v} />
                            <AuditInfo row={v} names={names} />
                          </FormDialog>
                          <ToggleButton
                            active={v.active}
                            action={toggleVehicle.bind(null, v.id, !v.active)}
                            noun="vehículo"
                          />
                          <ConfirmButton action={deleteVehicle.bind(null, v.id)} title="¿Eliminar vehículo?" />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {showMoney && (
        <p className="text-xs text-muted-foreground">
          Margen = facturado − gasoil de recorridos − pago a choferes − gastos de la unidad sin combustible (en el período; el monto enlaza a Gastos).
        </p>
      )}

      <h2 className="text-lg font-medium">Choferes</h2>
      {driverList.length === 0 ? (
        <EmptyState>No hay choferes cargados.</EmptyState>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Recorridos</TableHead>
                <TableHead className="text-right">Pago al chofer</TableHead>
                {canEdit && <TableHead className="w-28" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {driverList.map((d) => {
                const s = driverStats.get(d.id);
                return (
                  <TableRow key={d.id} className={d.active ? undefined : "text-muted-foreground"}>
                    <TableCell className="font-medium">
                      {d.name}
                      {d.notes && <span className="block text-xs font-normal text-muted-foreground">{d.notes}</span>}
                    </TableCell>
                    <TableCell>{d.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={d.active ? "secondary" : "outline"}>{d.active ? "Activo" : "Inactivo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s?.n ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(s?.driverPay ?? 0)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex justify-end">
                          <FormDialog
                            title="Editar chofer"
                            action={saveDriver.bind(null, d.id)}
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label="Editar">
                                <Pencil className="text-muted-foreground" />
                              </Button>
                            }
                          >
                            <DriverFields value={d} />
                            <AuditInfo row={d} names={names} />
                          </FormDialog>
                          <ToggleButton active={d.active} action={toggleDriver.bind(null, d.id, !d.active)} noun="chofer" />
                          <ConfirmButton action={deleteDriver.bind(null, d.id)} title="¿Eliminar chofer?" />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function ToggleButton({
  active,
  action,
  noun,
}: {
  active: boolean;
  action: Parameters<typeof ConfirmButton>[0]["action"];
  noun: string;
}) {
  const label = active ? "Desactivar" : "Activar";
  return (
    <ConfirmButton
      action={action}
      title={`¿${label} ${noun}?`}
      description={
        active
          ? `No va a aparecer para elegir en recorridos y gastos nuevos. Los movimientos existentes no cambian.`
          : `Va a volver a aparecer para elegir en recorridos y gastos.`
      }
      confirmLabel={label}
      trigger={
        <Button variant="ghost" size="icon-sm" title={label} aria-label={label}>
          <Power className="text-muted-foreground" />
        </Button>
      }
    />
  );
}
