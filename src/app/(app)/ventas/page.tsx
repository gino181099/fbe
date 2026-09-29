import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { clients, drivers, routes, trips, vehicles } from "@/db/schema";
import { sumOf } from "@/lib/balances";
import { formatDate, formatMoney, today } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { createTrip, deleteTrip, updateTrip } from "./actions";
import { TripFormDialog } from "./trip-form";

export const metadata: Metadata = { title: "Ventas" };

const PAGE_SIZE = 50;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function SalesPage({ searchParams }: PageProps<"/ventas">) {
  const user = await requirePermission("ventas");
  const sp = await searchParams;
  const desde = isDate(str(sp.desde));
  const hasta = isDate(str(sp.hasta));
  const clienteId = Number(str(sp.cliente)) || undefined;
  const recorridoId = Number(str(sp.recorrido)) || undefined;
  const chofer = Number(str(sp.chofer)) || undefined;
  const vehiculo = Number(str(sp.vehiculo)) || undefined;
  const page = Math.max(1, Number(str(sp.pagina)) || 1);

  const filters: SQL[] = [];
  if (desde) filters.push(gte(trips.date, desde));
  if (hasta) filters.push(lte(trips.date, hasta));
  if (clienteId) filters.push(eq(trips.clientId, clienteId));
  if (recorridoId) filters.push(eq(trips.routeId, recorridoId));
  if (chofer) filters.push(eq(trips.driverId, chofer));
  if (vehiculo) filters.push(eq(trips.vehicleId, vehiculo));
  const where = and(...filters);

  const [rows, [totals], clientList, routeList, driverList, vehicleList] = await Promise.all([
    db
      .select({
        trip: trips,
        clientName: clients.name,
        clientType: clients.type,
        routeName: routes.name,
        driverName: drivers.name,
        vehiclePlate: vehicles.plate,
      })
      .from(trips)
      .innerJoin(clients, eq(clients.id, trips.clientId))
      .leftJoin(routes, eq(routes.id, trips.routeId))
      .leftJoin(drivers, eq(drivers.id, trips.driverId))
      .leftJoin(vehicles, eq(vehicles.id, trips.vehicleId))
      .where(where)
      .orderBy(desc(trips.date), desc(trips.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({
        n: count(),
        price: sumOf(trips.price),
        driverPay: sumOf(trips.driverPay),
        fuel: sumOf(trips.fuelPesos),
        extra: sumOf(trips.extraPayments),
      })
      .from(trips)
      .where(where),
    db.select({ id: clients.id, name: clients.name, type: clients.type }).from(clients).orderBy(asc(clients.name)),
    db.select().from(routes).orderBy(asc(routes.name)),
    db.select({ id: drivers.id, name: drivers.name, active: drivers.active }).from(drivers).orderBy(asc(drivers.name)),
    db
      .select({
        id: vehicles.id,
        plate: vehicles.plate,
        model: vehicles.model,
        seats: vehicles.seats,
        active: vehicles.active,
      })
      .from(vehicles)
      .orderBy(asc(vehicles.plate)),
  ]);

  const canEdit = can(user, "ventas", "edit");
  const pages = Math.max(1, Math.ceil(totals.n / PAGE_SIZE));
  const costs = totals.driverPay + totals.fuel + totals.extra;
  const hasFilters = desde || hasta || clienteId || recorridoId || chofer || vehiculo;

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ desde, hasta, cliente: clienteId, recorrido: recorridoId, chofer, vehiculo })) {
      if (v) params.set(k, String(v));
    }
    params.set("pagina", String(p));
    return `/ventas?${params}`;
  };

  const formProps = { clients: clientList, routes: routeList, drivers: driverList, vehicles: vehicleList };

  return (
    <>
      <PageHeader
        title="Ventas"
        description="Recorridos realizados."
        actions={
          canEdit && (
            <TripFormDialog
              {...formProps}
              title="Nuevo recorrido"
              action={createTrip}
              defaults={{ date: today(), clientId: clienteId }}
              trigger={
                <Button>
                  <Plus /> Nuevo recorrido
                </Button>
              }
            />
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
        <NativeSelect name="cliente" defaultValue={clienteId ?? ""}>
          <NativeSelectOption value="">Todos los clientes</NativeSelectOption>
          {clientList.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="recorrido" defaultValue={recorridoId ?? ""}>
          <NativeSelectOption value="">Todos los recorridos</NativeSelectOption>
          {routeList.map((r) => (
            <NativeSelectOption key={r.id} value={r.id}>
              {r.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="chofer" defaultValue={chofer ?? ""}>
          <NativeSelectOption value="">Todos los choferes</NativeSelectOption>
          {driverList.map((d) => (
            <NativeSelectOption key={d.id} value={d.id}>
              {d.name}
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
        {hasFilters && (
          <Button variant="ghost" asChild>
            <Link href="/ventas">Limpiar</Link>
          </Button>
        )}
      </form>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Recorridos" value={totals.n} />
        <StatCard label="Facturado" value={formatMoney(totals.price)} />
        <StatCard label="Costos directos" value={formatMoney(costs)} hint="Chofer + gasoil + adicionales" />
        <StatCard label="Margen" value={formatMoney(totals.price - costs)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState>No hay recorridos con esos filtros.</EmptyState>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Recorrido</TableHead>
                <TableHead className="text-right">Pax</TableHead>
                <TableHead className="text-right">Cap.</TableHead>
                <TableHead>Chofer</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Pago chofer</TableHead>
                <TableHead className="text-right">Gasoil</TableHead>
                {canEdit && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ trip: t, clientName, routeName, driverName, vehiclePlate }) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(t.date)}</TableCell>
                  <TableCell>{clientName}</TableCell>
                  <TableCell>
                    {routeName ?? t.routeText ?? "—"}
                    {t.notes && <span className="block text-xs text-muted-foreground">{t.notes}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.passengers ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.capacity ?? "—"}</TableCell>
                  <TableCell>{driverName ?? t.driver ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{vehiclePlate ?? "—"}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${t.price === 0 ? "font-medium text-destructive" : ""}`}
                    title={t.price === 0 ? "Sin precio: revisar tarifa" : undefined}
                  >
                    {formatMoney(t.price)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(t.driverPay)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(t.fuelPesos)}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex justify-end">
                        <TripFormDialog
                          {...formProps}
                          title="Editar recorrido"
                          action={updateTrip.bind(null, t.id)}
                          defaults={t}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label="Editar">
                              <Pencil className="text-muted-foreground" />
                            </Button>
                          }
                        />
                        <ConfirmButton action={deleteTrip.bind(null, t.id)} title="¿Eliminar recorrido?" />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={7}>Total ({totals.n} recorridos)</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(totals.price)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(totals.driverPay)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(totals.fuel)}</TableCell>
                {canEdit && <TableCell />}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            Página {page} de {pages}
          </span>
          <Button variant="outline" size="icon-sm" asChild disabled={page <= 1}>
            <Link href={pageHref(Math.max(1, page - 1))} aria-label="Anterior">
              <ChevronLeft />
            </Link>
          </Button>
          <Button variant="outline" size="icon-sm" asChild disabled={page >= pages}>
            <Link href={pageHref(Math.min(pages, page + 1))} aria-label="Siguiente">
              <ChevronRight />
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
