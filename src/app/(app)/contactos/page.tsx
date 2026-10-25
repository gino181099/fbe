import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, ilike, ne, or, type SQL } from "drizzle-orm";
import { Plus } from "lucide-react";
import { ClientStatusBadge, ClientTypeBadge } from "@/components/badges";
import { FormDialog } from "@/components/form-dialog";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { CLIENT_STATUSES, CLIENT_TYPES, clients } from "@/db/schema";
import { getBalances } from "@/lib/balances";
import { formatMoney } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { createClient } from "./actions";
import { ClientFields } from "./client-fields";

export const metadata: Metadata = { title: "Contactos" };

export default async function ContactsPage({ searchParams }: PageProps<"/contactos">) {
  const user = await requirePermission("contactos");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const tipo = CLIENT_TYPES.find((t) => t === sp.tipo && t !== "potencial");
  const estado = CLIENT_STATUSES.find((s) => s === sp.estado && s !== "potencial");

  // Los potenciales (prospectos) se gestionan en Leads.
  const filters: SQL[] = [ne(clients.type, "potencial")];
  if (q) filters.push(or(ilike(clients.name, `%${q}%`), ilike(clients.contactPerson, `%${q}%`))!);
  if (tipo) filters.push(eq(clients.type, tipo));
  if (estado) filters.push(eq(clients.status, estado));

  const [rows, balances] = await Promise.all([
    db.select().from(clients).where(and(...filters)).orderBy(asc(clients.name)),
    getBalances(),
  ]);
  const canEdit = can(user, "contactos", "edit");
  const showBalance = can(user, "finanzas", "view");

  return (
    <>
      <PageHeader help="contactos"
        title="Contactos"
        description={
          <>
            Clientes actuales. Los prospectos y propuestas están en{" "}
            <Link href="/leads" className="underline">
              Leads
            </Link>
            .
          </>
        }
        actions={
          canEdit && (
            <FormDialog
              title="Nuevo contacto"
              action={createClient}
              trigger={
                <Button>
                  <Plus /> Nuevo contacto
                </Button>
              }
            >
              <ClientFields />
            </FormDialog>
          )
        }
      />

      <form className="flex flex-wrap items-end gap-2">
        <Input name="q" defaultValue={q} placeholder="Buscar por nombre o contacto…" className="w-64" />
        <NativeSelect name="tipo" defaultValue={tipo ?? ""}>
          <NativeSelectOption value="">Todos los tipos</NativeSelectOption>
          <NativeSelectOption value="recurrente">Recurrentes</NativeSelectOption>
          <NativeSelectOption value="especial">Especiales</NativeSelectOption>
        </NativeSelect>
        <NativeSelect name="estado" defaultValue={estado ?? ""}>
          <NativeSelectOption value="">Todos los estados</NativeSelectOption>
          <NativeSelectOption value="activo">Activos</NativeSelectOption>
          <NativeSelectOption value="inactivo">Inactivos</NativeSelectOption>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {(q || tipo || estado) && (
          <Button variant="ghost" asChild>
            <Link href="/contactos">Limpiar</Link>
          </Button>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState>No hay contactos que coincidan.</EmptyState>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="text-right">Recorridos</TableHead>
                {showBalance && <TableHead className="text-right">Saldo</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const b = balances.get(c.id);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/contactos/${c.id}`} className="hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <ClientTypeBadge type={c.type} />
                    </TableCell>
                    <TableCell>
                      <ClientStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[c.contactPerson, c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b?.trips ?? 0}</TableCell>
                    {showBalance && (
                      <TableCell className="text-right tabular-nums">{formatMoney(b?.balance ?? 0)}</TableCell>
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
