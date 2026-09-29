import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { Pencil, Plus } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { clients, collections } from "@/db/schema";
import { COLLECTION_KIND_LABELS, COLLECTION_KINDS } from "@/lib/constants";
import { formatDate, formatMoney, today } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { deleteCollection, saveCollection } from "../actions";
import { CollectionFields } from "../fields";

export const metadata: Metadata = { title: "Cobros" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function CollectionsPage({ searchParams }: PageProps<"/finanzas/cobros">) {
  const user = await requirePermission("finanzas");
  const sp = await searchParams;
  const desde = isDate(str(sp.desde));
  const hasta = isDate(str(sp.hasta));
  const clienteId = Number(str(sp.cliente)) || undefined;
  const tipo = COLLECTION_KINDS.find((k) => k === str(sp.tipo));

  const filters: SQL[] = [];
  if (tipo) filters.push(eq(collections.kind, tipo));
  if (desde) filters.push(gte(collections.date, desde));
  if (hasta) filters.push(lte(collections.date, hasta));
  if (clienteId) filters.push(eq(collections.clientId, clienteId));

  const [rows, clientList] = await Promise.all([
    db
      .select({ c: collections, clientName: clients.name })
      .from(collections)
      .innerJoin(clients, eq(clients.id, collections.clientId))
      .where(and(...filters))
      .orderBy(desc(collections.date), desc(collections.id))
      .limit(500),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
  ]);
  const canEdit = can(user, "finanzas", "edit");
  const totalCobros = rows.reduce((s, r) => s + (r.c.kind === "cobro" ? r.c.amount : 0), 0);
  const totalAjustes = rows.reduce((s, r) => s + (r.c.kind === "ajuste" ? r.c.amount : 0), 0);
  const footer = [
    ...(tipo !== "ajuste" ? [{ label: "Total cobrado", value: totalCobros }] : []),
    ...(tipo !== "cobro" ? [{ label: "Total ajustes", value: totalAjustes }] : []),
  ];
  const date = today();

  return (
    <>
      <PageHeader
        title="Cobros"
        description="Pagos recibidos de clientes y ajustes de saldo. Ambos se descuentan de su cuenta corriente."
        actions={
          canEdit && (
            <FormDialog
              title="Registrar cobro"
              action={saveCollection.bind(null, null)}
              trigger={
                <Button>
                  <Plus /> Registrar cobro
                </Button>
              }
            >
              <CollectionFields clients={clientList} defaultDate={date} defaultClientId={clienteId} />
            </FormDialog>
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
        <NativeSelect name="tipo" defaultValue={tipo ?? ""} aria-label="Tipo">
          <NativeSelectOption value="">Tipo: Todos</NativeSelectOption>
          <NativeSelectOption value="cobro">Cobros</NativeSelectOption>
          <NativeSelectOption value="ajuste">Ajustes</NativeSelectOption>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {(desde || hasta || clienteId || tipo) && (
          <Button variant="ghost" asChild>
            <Link href="/finanzas/cobros">Limpiar</Link>
          </Button>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState>Todavía no hay cobros registrados.</EmptyState>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Medio</TableHead>
                <TableHead>Observaciones</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                {canEdit && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ c, clientName }) => (
                <TableRow key={c.id}>
                  <TableCell>{formatDate(c.date)}</TableCell>
                  <TableCell>{clientName}</TableCell>
                  <TableCell>
                    {c.kind === "ajuste" ? (
                      <Badge variant="secondary">{COLLECTION_KIND_LABELS.ajuste}</Badge>
                    ) : (
                      COLLECTION_KIND_LABELS.cobro
                    )}
                  </TableCell>
                  <TableCell>{c.method ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.notes ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(c.amount)}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex justify-end">
                        <FormDialog
                          title="Editar cobro"
                          action={saveCollection.bind(null, c.id)}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label="Editar">
                              <Pencil className="text-muted-foreground" />
                            </Button>
                          }
                        >
                          <CollectionFields clients={clientList} value={c} defaultDate={date} />
                        </FormDialog>
                        <ConfirmButton action={deleteCollection.bind(null, c.id)} title="¿Eliminar cobro?" />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              {footer.map((f) => (
                <TableRow key={f.label}>
                  <TableCell colSpan={5}>{f.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(f.value)}</TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              ))}
            </TableFooter>
          </Table>
        </div>
      )}
    </>
  );
}
