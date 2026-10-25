import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { ArrowLeft, Pencil } from "lucide-react";
import { ActivitiesPanel } from "@/components/activities-panel";
import { AuditInfo } from "@/components/audit-info";
import { FormDialog } from "@/components/form-dialog";
import { EmptyState, PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { expenses, trips, vehicles } from "@/db/schema";
import { getUserNames } from "@/lib/audit";
import { sumOf } from "@/lib/balances";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { firstDayOfMonth, formatDate, formatMoney } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { saveVehicle } from "../actions";
import { VehicleFields } from "../vehicle-form";

const getVehicle = cache(async (id: number) => {
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  return v;
});

export async function generateMetadata({ params }: PageProps<"/flota/[id]">): Promise<Metadata> {
  const id = Number((await params).id);
  const v = Number.isInteger(id) ? await getVehicle(id) : undefined;
  return { title: v ? `${v.plate} · Flota` : "Vehículo" };
}

/** Ficha del vehículo: actividades (service, VTV, seguro…) y últimos gastos. */
export default async function VehiclePage({ params }: PageProps<"/flota/[id]">) {
  const user = await requirePermission("ventas");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const monthStart = firstDayOfMonth();

  const [vehicle, [monthTrips], [monthExpenses], recentExpenses, names] = await Promise.all([
    getVehicle(id),
    db
      .select({ n: count() })
      .from(trips)
      .where(and(eq(trips.vehicleId, id), gte(trips.date, monthStart))),
    db
      .select({ total: sumOf(expenses.amount) })
      .from(expenses)
      .where(and(eq(expenses.vehicleId, id), gte(expenses.date, monthStart))),
    db
      .select()
      .from(expenses)
      .where(eq(expenses.vehicleId, id))
      .orderBy(desc(expenses.date), desc(expenses.id))
      .limit(15),
    getUserNames(),
  ]);
  if (!vehicle) notFound();
  const canEdit = can(user, "ventas", "edit");
  const canFinance = can(user, "finanzas", "view");

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/flota">
          <ArrowLeft /> Flota
        </Link>
      </Button>
      <PageHeader help="flota"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {vehicle.plate}
            <Badge variant={vehicle.active ? "secondary" : "outline"}>{vehicle.active ? "Activo" : "Inactivo"}</Badge>
          </span>
        }
        description={`${vehicle.model} · ${vehicle.seats} plazas${vehicle.notes ? ` · ${vehicle.notes}` : ""}`}
        actions={
          canEdit && (
            <FormDialog
              title="Editar vehículo"
              action={saveVehicle.bind(null, vehicle.id)}
              trigger={
                <Button variant="outline">
                  <Pencil /> Editar
                </Button>
              }
            >
              <VehicleFields value={vehicle} />
              <AuditInfo row={vehicle} names={names} />
            </FormDialog>
          )
        }
      />
      <AuditInfo row={vehicle} names={names} />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Recorridos este mes" value={monthTrips.n} />
        {canFinance && <StatCard label="Gastos este mes" value={formatMoney(monthExpenses.total)} />}
      </div>

      <section className="grid gap-3">
        <h2 className="font-semibold">Actividades</h2>
        <ActivitiesPanel link={{ field: "vehicleId", id: vehicle.id, label: vehicle.plate }} currentUserId={user.id} />
      </section>

      {canFinance && (
        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Últimos gastos</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/finanzas/gastos?vehiculo=${vehicle.id}`}>Ver todos</Link>
            </Button>
          </div>
          {recentExpenses.length === 0 ? (
            <EmptyState>No hay gastos cargados para este vehículo.</EmptyState>
          ) : (
            <div className="surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Qué / para qué</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentExpenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(e.date)}</TableCell>
                      <TableCell>{EXPENSE_CATEGORY_LABELS[e.category]}</TableCell>
                      <TableCell>{[e.concept, e.purpose].filter(Boolean).join(" · ") || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(e.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
