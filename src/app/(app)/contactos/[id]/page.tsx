import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { ArrowLeft, FileText, Pencil } from "lucide-react";
import { ClientStatusBadge, ClientTypeBadge, OpportunityStageBadge } from "@/components/badges";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { EmptyState, Field, PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { clientNotes, clients, drivers, leadNotes, leads, rates, routes, trips, users } from "@/db/schema";
import { mergeNotes, NotesPanel } from "@/components/notes-panel";
import { ActivitiesPanel } from "@/components/activities-panel";
import { AuditInfo } from "@/components/audit-info";
import { getUserNames } from "@/lib/audit";
import { getBalances } from "@/lib/balances";
import { formatDate, formatMoney, today } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { LEAD_PRIORITY_LABELS, type LeadPriority } from "@/lib/constants";
import { canDeleteNote } from "@/lib/prospects";
import { ratesInForce } from "@/lib/rates";
import {
  addClientNote,
  deleteClient,
  deleteClientNote,
  deleteRate,
  updateClient,
  updateRate,
} from "../actions";
import { ClientFields } from "../client-fields";
import { RateVersionDialog } from "./rate-version-dialog";

// Compartido entre generateMetadata y la página: una sola consulta por request.
const getClient = cache(async (id: number) => {
  const [c] = await db.select().from(clients).where(eq(clients.id, id));
  return c;
});

export async function generateMetadata({ params }: PageProps<"/contactos/[id]">): Promise<Metadata> {
  const id = Number((await params).id);
  const c = Number.isInteger(id) ? await getClient(id) : undefined;
  return { title: c?.name ?? "Contacto" };
}

export default async function ClientPage({ params, searchParams }: PageProps<"/contactos/[id]">) {
  const user = await requirePermission("contactos");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;

  const date = today();
  const [client, current, history, routeList, recentTrips, balances, notes, opportunities, oppNotes, names] = await Promise.all([
    getClient(id),
    ratesInForce(id, date),
    db
      .select({
        id: rates.id,
        routeId: rates.routeId,
        routeName: routes.name,
        capacity: rates.capacity,
        price: rates.price,
        validFrom: rates.validFrom,
        validTo: rates.validTo,
      })
      .from(rates)
      .innerJoin(routes, eq(routes.id, rates.routeId))
      .where(eq(rates.clientId, id))
      .orderBy(desc(rates.validFrom), asc(routes.name), asc(rates.capacity)),
    db.select().from(routes).orderBy(asc(routes.name)),
    db
      .select({
        id: trips.id,
        date: trips.date,
        route: routes.name,
        routeText: trips.routeText,
        passengers: trips.passengers,
        capacity: trips.capacity,
        driver: sql<string | null>`coalesce(${drivers.name}, ${trips.driver})`,
        price: trips.price,
      })
      .from(trips)
      .leftJoin(routes, eq(routes.id, trips.routeId))
      .leftJoin(drivers, eq(drivers.id, trips.driverId))
      .where(eq(trips.clientId, id))
      .orderBy(desc(trips.date), desc(trips.id))
      .limit(15),
    getBalances(id),
    db
      .select({
        id: clientNotes.id,
        date: clientNotes.date,
        text: clientNotes.text,
        auto: clientNotes.auto,
        userId: clientNotes.userId,
        author: sql<string | null>`coalesce(${users.name}, ${users.username}, ${users.email})`,
      })
      .from(clientNotes)
      .leftJoin(users, eq(users.id, clientNotes.userId))
      .where(eq(clientNotes.clientId, id))
      .orderBy(desc(clientNotes.date), desc(clientNotes.id)),
    db
      .select({ id: leads.id, title: leads.title, stage: leads.stage, expectedAmount: leads.expectedAmount })
      .from(leads)
      .where(eq(leads.clientId, id))
      .orderBy(desc(leads.updatedAt)),
    db
      .select({
        id: leadNotes.id,
        leadId: leadNotes.leadId,
        leadTitle: leads.title,
        date: leadNotes.date,
        text: leadNotes.text,
        auto: leadNotes.auto,
        author: sql<string | null>`coalesce(${users.name}, ${users.username}, ${users.email})`,
      })
      .from(leadNotes)
      .innerJoin(leads, eq(leads.id, leadNotes.leadId))
      .leftJoin(users, eq(users.id, leadNotes.userId))
      .where(eq(leads.clientId, id)),
    getUserNames(),
  ]);
  if (!client) notFound();

  const canEdit = can(user, "contactos", "edit");
  const canFinance = can(user, "finanzas", "view");
  const canSales = can(user, "ventas", "view");
  const canLeads = can(user, "leads", "view") && opportunities.length > 0;
  const balance = balances.get(id);
  // Notas del contacto + las de sus oportunidades (solo lectura acá, con link a la oportunidad).
  const allNotes = mergeNotes(
    notes.map((n) => ({
      key: `c${n.id}`,
      ...n,
      onDelete: canEdit && canDeleteNote(n, user.id) ? deleteClientNote.bind(null, id, n.id) : undefined,
    })),
    canLeads
      ? oppNotes.map((n) => ({
          key: `l${n.id}`,
          ...n,
          source: { label: `Oportunidad: ${n.leadTitle}`, href: `/leads/${n.leadId}` },
        }))
      : [],
  );
  const defaultTab =
    typeof sp.tab === "string"
      ? sp.tab
      : client.type === "recurrente"
        ? "tarifario"
        : client.type === "potencial"
          ? canLeads
            ? "oportunidades"
            : "notas"
          : "notas";
  const priority = client.leadPriority as LeadPriority | null;

  // Matriz de tarifas vigentes: filas = recorridos, columnas = capacidades.
  const capacities = [...new Set(current.map((r) => r.capacity))].sort((a, b) => a - b);
  const matrix = new Map<string, Map<number, (typeof current)[number]>>();
  for (const r of current) {
    if (!matrix.has(r.routeName)) matrix.set(r.routeName, new Map());
    matrix.get(r.routeName)!.set(r.capacity, r);
  }
  const lastUpdate = current.reduce((max, r) => (r.validFrom > max ? r.validFrom : max), "");

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/contactos">
          <ArrowLeft /> Contactos
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {client.name} <ClientTypeBadge type={client.type} /> <ClientStatusBadge status={client.status} />
          </span>
        }
        description={[client.contactPerson, client.phone, client.email].filter(Boolean).join(" · ") || undefined}
        actions={
          canEdit && (
            <>
              <FormDialog
                title="Editar contacto"
                action={updateClient.bind(null, id)}
                trigger={
                  <Button variant="outline">
                    <Pencil /> Editar
                  </Button>
                }
              >
                <ClientFields client={client} />
                <AuditInfo row={client} names={names} />
              </FormDialog>
              <ConfirmButton
                action={deleteClient.bind(null, id)}
                title="¿Eliminar contacto?"
                description="Solo se pueden eliminar contactos sin recorridos ni cobros."
              />
            </>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Recorridos" value={balance?.trips ?? 0} />
        {canFinance && <StatCard label="Facturado" value={formatMoney(balance?.billed ?? 0)} />}
        {canFinance && (
          <StatCard
            label="Saldo pendiente"
            value={formatMoney(balance?.balance ?? 0)}
            hint={
              <Link href={`/finanzas/cuentas/${id}`} className="underline">
                Ver estado de cuenta
              </Link>
            }
          />
        )}
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="tarifario">Tarifario</TabsTrigger>
          <TabsTrigger value="historial">Historial de tarifas</TabsTrigger>
          <TabsTrigger value="recorridos">Recorridos</TabsTrigger>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="notas">Notas{allNotes.length > 0 && ` (${allNotes.length})`}</TabsTrigger>
          <TabsTrigger value="actividades">Actividades</TabsTrigger>
          {canLeads && <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>}
        </TabsList>

        {canLeads && (
          <TabsContent value="oportunidades" className="pt-2">
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Oportunidad</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Monto estimado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/leads/${o.id}`} className="font-medium hover:underline">
                          {o.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <OpportunityStageBadge stage={o.stage} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(o.expectedAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}

        <TabsContent value="tarifario" className="grid gap-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {current.length
                ? `Tarifas vigentes hoy · última actualización ${formatDate(lastUpdate)}`
                : client.type === "recurrente"
                  ? "Este cliente todavía no tiene tarifas cargadas."
                  : "Los clientes especiales no suelen tener tarifario; si cargás uno pasa a ser recurrente."}
            </p>
            {canEdit && (
              <RateVersionDialog
                clientId={id}
                clientName={client.name}
                current={current}
                routes={routeList}
                defaultDate={date}
              />
            )}
          </div>
          {current.length > 0 && (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recorrido</TableHead>
                    {capacities.map((c) => (
                      <TableHead key={c} className="text-right">
                        {c} plazas
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...matrix.entries()].map(([route, byCap]) => (
                    <TableRow key={route}>
                      <TableCell className="font-medium">{route}</TableCell>
                      {capacities.map((c) => (
                        <TableCell key={c} className="text-right tabular-nums">
                          {byCap.get(c) ? formatMoney(byCap.get(c)!.price) : "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="historial" className="pt-2">
          {history.length === 0 ? (
            <EmptyState>Sin tarifas cargadas.</EmptyState>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Recorrido</TableHead>
                    <TableHead>Capacidad</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    {canEdit && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((r) => {
                    const active = r.validFrom <= date && (!r.validTo || r.validTo >= date);
                    return (
                      <TableRow key={r.id} className={active ? "" : "text-muted-foreground"}>
                        <TableCell>
                          {formatDate(r.validFrom)} → {r.validTo ? formatDate(r.validTo) : "actual"}
                        </TableCell>
                        <TableCell>{r.routeName}</TableCell>
                        <TableCell>{r.capacity}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(r.price)}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex justify-end">
                              <FormDialog
                                title="Editar tarifa"
                                description="Para un aumento, usá “Nueva versión del tarifario” así se conserva el historial."
                                action={updateRate.bind(null, id, r.id)}
                                trigger={
                                  <Button variant="ghost" size="icon-sm" aria-label="Editar tarifa">
                                    <Pencil className="text-muted-foreground" />
                                  </Button>
                                }
                              >
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <Field label="Recorrido" htmlFor="routeId">
                                    <NativeSelect id="routeId" name="routeId" defaultValue={r.routeId} className="w-full">
                                      {routeList.map((x) => (
                                        <NativeSelectOption key={x.id} value={x.id}>
                                          {x.name}
                                        </NativeSelectOption>
                                      ))}
                                    </NativeSelect>
                                  </Field>
                                  <Field label="Capacidad" htmlFor="capacity">
                                    <Input id="capacity" name="capacity" type="number" defaultValue={r.capacity} />
                                  </Field>
                                  <Field label="Precio" htmlFor="price" className="sm:col-span-2">
                                    <Input id="price" name="price" inputMode="decimal" defaultValue={r.price} />
                                  </Field>
                                  <Field label="Vigente desde" htmlFor="validFrom">
                                    <Input id="validFrom" name="validFrom" type="date" defaultValue={r.validFrom} />
                                  </Field>
                                  <Field label="Hasta (vacío = sin fin)" htmlFor="validTo">
                                    <Input id="validTo" name="validTo" type="date" defaultValue={r.validTo ?? ""} />
                                  </Field>
                                </div>
                              </FormDialog>
                              <ConfirmButton action={deleteRate.bind(null, id, r.id)} title="¿Eliminar tarifa?" />
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
        </TabsContent>

        <TabsContent value="recorridos" className="grid gap-3 pt-2">
          {recentTrips.length === 0 ? (
            <EmptyState>Sin recorridos registrados.</EmptyState>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Recorrido</TableHead>
                    <TableHead>Pax / Cap.</TableHead>
                    <TableHead>Chofer</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTrips.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.date)}</TableCell>
                      <TableCell>{t.route ?? t.routeText ?? "—"}</TableCell>
                      <TableCell>
                        {t.passengers ?? "—"} / {t.capacity ?? "—"}
                      </TableCell>
                      <TableCell>{t.driver ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(t.price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {canSales && (
            <Button variant="outline" asChild className="w-fit">
              <Link href={`/ventas?cliente=${id}`}>Ver todos en Ventas</Link>
            </Button>
          )}
        </TabsContent>

        <TabsContent value="datos" className="pt-2">
          <dl className="grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2">
            {(
              [
                ["Persona de contacto", client.contactPerson],
                ["CUIT", client.cuit],
                ["Teléfono", client.phone],
                ["Email", client.email],
                ["Dirección", client.address],
                ["Segmento", client.segment],
                ["Prioridad", priority ? (LEAD_PRIORITY_LABELS[priority] ?? priority) : null],
                ["Alta", formatDate(client.createdAt.toISOString())],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value || "—"}</dd>
              </div>
            ))}
            <div>
              <dt className="text-muted-foreground">Sitio web</dt>
              <dd className="font-medium break-all">
                {client.website ? (
                  <a
                    href={/^https?:\/\//i.test(client.website) ? client.website : `https://${client.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {client.website}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Notas</dt>
              <dd className="whitespace-pre-wrap">{client.notes || "—"}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <AuditInfo row={client} names={names} />
          </div>
          {canFinance && (
            <Button variant="outline" asChild className="mt-4">
              <Link href={`/finanzas/cuentas/${id}`}>
                <FileText /> Estado de cuenta
              </Link>
            </Button>
          )}
        </TabsContent>

        <TabsContent value="notas" className="pt-2">
          <NotesPanel notes={allNotes} addAction={canEdit ? addClientNote.bind(null, id) : undefined} date={date} />
        </TabsContent>

        <TabsContent value="actividades" className="pt-2">
          <ActivitiesPanel link={{ field: "clientId", id, label: client.name }} currentUserId={user.id} />
        </TabsContent>
      </Tabs>
    </>
  );
}
