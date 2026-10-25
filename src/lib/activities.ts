import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lte, min, ne, notInArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { activities, clients, leads, suppliers, users, vehicles } from "@/db/schema";
import { today } from "./format";

/** Vínculo de una actividad con otro registro (se fija al crearla desde una ficha). */
export type ActivityLink = { clientId?: number; leadId?: number; vehicleId?: number; supplierId?: number };

export type ActivityFilter = ActivityLink & {
  /** Sin valor: de todos los usuarios. */
  assignedTo?: string;
  /** Sin valor: pendientes y hechas (calendario). */
  done?: boolean;
  /** Rango de vencimiento (calendario). */
  from?: string;
  to?: string;
  limit?: number;
};

/** Actividades con el nombre de lo vinculado. Pendientes y calendario: por vencimiento; hechas: las últimas primero. */
export async function getActivities(f: ActivityFilter) {
  const where: SQL[] = [];
  if (f.done !== undefined) where.push(f.done ? isNotNull(activities.doneAt) : isNull(activities.doneAt));
  if (f.from) where.push(gte(activities.dueDate, f.from));
  if (f.to) where.push(lte(activities.dueDate, f.to));
  if (f.assignedTo) where.push(eq(activities.assignedTo, f.assignedTo));
  if (f.clientId) where.push(eq(activities.clientId, f.clientId));
  if (f.leadId) where.push(eq(activities.leadId, f.leadId));
  if (f.vehicleId) where.push(eq(activities.vehicleId, f.vehicleId));
  if (f.supplierId) where.push(eq(activities.supplierId, f.supplierId));
  return db
    .select({
      activity: activities,
      clientName: clients.name,
      leadTitle: leads.title,
      vehiclePlate: vehicles.plate,
      supplierName: suppliers.name,
    })
    .from(activities)
    .leftJoin(clients, eq(clients.id, activities.clientId))
    .leftJoin(leads, eq(leads.id, activities.leadId))
    .leftJoin(vehicles, eq(vehicles.id, activities.vehicleId))
    .leftJoin(suppliers, eq(suppliers.id, activities.supplierId))
    .where(and(...where))
    .orderBy(...(f.done ? [desc(activities.doneAt)] : [asc(activities.dueDate), asc(activities.id)]))
    .limit(f.limit ?? 500);
}

/** Por vehículo: cantidad de actividades pendientes y el vencimiento más próximo (para el punto de color). */
export async function pendingByVehicle() {
  const rows = await db
    .select({ vehicleId: activities.vehicleId, n: count(), next: min(activities.dueDate) })
    .from(activities)
    .where(and(isNull(activities.doneAt), isNotNull(activities.vehicleId)))
    .groupBy(activities.vehicleId);
  return new Map(rows.map((r) => [r.vehicleId!, { n: r.n, next: r.next! }]));
}

export type ActivityRow = Awaited<ReturnType<typeof getActivities>>[number];

/** Pendientes de un usuario que vencen hoy o antes (número del menú). */
export async function countDueActivities(userId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(activities)
    .where(and(eq(activities.assignedTo, userId), isNull(activities.doneAt), lte(activities.dueDate, today())));
  return n;
}

/** Opciones para vincular una actividad (contactos no inactivos, oportunidades abiertas, flota y proveedores activos). */
export async function getActivityLinkOptions() {
  const [clientRows, leadRows, vehicleRows, supplierRows] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).where(ne(clients.status, "inactivo")).orderBy(asc(clients.name)),
    db
      .select({ id: leads.id, name: leads.title, company: leads.company })
      .from(leads)
      .where(notInArray(leads.stage, ["ganado", "perdido"]))
      .orderBy(asc(leads.company)),
    db
      .select({ id: vehicles.id, name: vehicles.plate, model: vehicles.model })
      .from(vehicles)
      .where(eq(vehicles.active, true))
      .orderBy(asc(vehicles.plate)),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.active, true)).orderBy(asc(suppliers.name)),
  ]);
  return {
    clients: clientRows,
    leads: leadRows.map((l) => ({ id: l.id, name: `${l.company} · ${l.name}` })),
    vehicles: vehicleRows.map((v) => ({ id: v.id, name: `${v.name} · ${v.model}` })),
    suppliers: supplierRows,
  };
}

export type ActivityLinkOptions = Awaited<ReturnType<typeof getActivityLinkOptions>>;

/** ¿Existen los usuarios? (para validar "Asignada a"). */
export async function usersExist(ids: string[]) {
  const rows = await db.select({ id: users.id }).from(users).where(inArray(users.id, ids));
  return rows.length === new Set(ids).size;
}
