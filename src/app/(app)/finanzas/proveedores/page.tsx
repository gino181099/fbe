import type { Metadata } from "next";
import Link from "next/link";
import { type SQL, and, asc, eq, ilike, isNotNull, or } from "drizzle-orm";
import { Pencil, Plus, Power } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { EmptyState, PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { SUPPLIER_CATEGORIES } from "@/lib/constants";
import { AuditInfo } from "@/components/audit-info";
import { getUserNames } from "@/lib/audit";
import { formatMoney } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { getSupplierBalances } from "@/lib/suppliers";
import { deleteSupplier, saveSupplier, toggleSupplier } from "../actions";
import { SupplierFormFields } from "../fields";

export const metadata: Metadata = { title: "Proveedores" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const STATUSES = ["activos", "inactivos", "todos"] as const;

export default async function SuppliersPage({ searchParams }: PageProps<"/finanzas/proveedores">) {
  const user = await requirePermission("finanzas");
  const sp = await searchParams;
  const q = str(sp.q);
  const rubro = str(sp.rubro);
  const estado = STATUSES.find((s) => s === str(sp.estado)) ?? "activos";

  const filters: SQL[] = [];
  if (q) filters.push(or(ilike(suppliers.name, `%${q}%`), ilike(suppliers.cuit, `%${q}%`))!);
  if (rubro) filters.push(eq(suppliers.category, rubro));
  if (estado !== "todos") filters.push(eq(suppliers.active, estado === "activos"));

  const [rows, balances, categoryRows, names] = await Promise.all([
    db
      .select()
      .from(suppliers)
      .where(and(...filters))
      .orderBy(asc(suppliers.name)),
    getSupplierBalances(),
    db
      .selectDistinct({ category: suppliers.category })
      .from(suppliers)
      .where(isNotNull(suppliers.category))
      .orderBy(asc(suppliers.category)),
    getUserNames(),
  ]);
  const canEdit = can(user, "finanzas", "edit");
  const usedCategories = categoryRows.map((c) => c.category!);
  const categories = [...new Set([...SUPPLIER_CATEGORIES, ...usedCategories])];
  const balanceOf = (id: number) => balances.get(id) ?? 0;
  const totalToPay = rows.reduce((s, r) => s + Math.max(balanceOf(r.id), 0), 0);
  const totalBalance = rows.reduce((s, r) => s + balanceOf(r.id), 0);

  return (
    <>
      <PageHeader help="proveedores"
        title="Proveedores"
        description="Lista de proveedores y saldo a pagar"
        actions={
          canEdit && (
            <FormDialog
              title="Nuevo proveedor"
              action={saveSupplier.bind(null, null)}
              trigger={
                <Button>
                  <Plus /> Nuevo proveedor
                </Button>
              }
            >
              <SupplierFormFields categories={usedCategories} />
            </FormDialog>
          )
        }
      />

      <form className="flex flex-wrap items-end gap-2">
        <Input name="q" placeholder="Buscar por nombre o CUIT" defaultValue={q} className="w-64" />
        <NativeSelect name="rubro" defaultValue={rubro ?? ""}>
          <NativeSelectOption value="">Todos los rubros</NativeSelectOption>
          {categories.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {c}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="estado" defaultValue={estado}>
          <NativeSelectOption value="activos">Activos</NativeSelectOption>
          <NativeSelectOption value="inactivos">Inactivos</NativeSelectOption>
          <NativeSelectOption value="todos">Todos</NativeSelectOption>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {(q || rubro || estado !== "activos") && (
          <Button variant="ghost" asChild>
            <Link href="/finanzas/proveedores">Limpiar</Link>
          </Button>
        )}
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total a pagar" value={formatMoney(totalToPay)} hint="Suma de saldos positivos" />
        <StatCard label="Proveedores" value={String(rows.length)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState>No hay proveedores con esos filtros.</EmptyState>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Rubro</TableHead>
                <TableHead>CUIT</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                {canEdit && <TableHead className="w-28" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => {
                const balance = balanceOf(s.id);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/finanzas/proveedores/${s.id}`} className="hover:underline">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell>{s.category ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{s.cuit ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.invoices ? "secondary" : "outline"}>{s.invoices ? "Factura" : "Sin factura"}</Badge>
                    </TableCell>
                    <TableCell>
                      {s.active ? <Badge variant="outline">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                    </TableCell>
                    <TableCell
                      className="text-right tabular-nums"
                      title={balance < 0 ? "Pagado de más / por adelantado" : undefined}
                    >
                      {formatMoney(balance)}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex justify-end">
                          <FormDialog
                            title="Editar proveedor"
                            action={saveSupplier.bind(null, s.id)}
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label="Editar">
                                <Pencil className="text-muted-foreground" />
                              </Button>
                            }
                          >
                            <SupplierFormFields key={`${s.id}-${s.name}-${s.category}`} value={s} categories={usedCategories} />
                            <AuditInfo row={s} names={names} />
                          </FormDialog>
                          <ConfirmButton
                            action={toggleSupplier.bind(null, s.id, !s.active)}
                            title={`¿${s.active ? "Desactivar" : "Activar"} proveedor?`}
                            description={
                              s.active
                                ? "No va a aparecer en el listado de activos. Sus movimientos y saldo no cambian."
                                : "Va a volver a aparecer en el listado de activos."
                            }
                            confirmLabel={s.active ? "Desactivar" : "Activar"}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title={s.active ? "Desactivar" : "Activar"}
                                aria-label={s.active ? "Desactivar" : "Activar"}
                              >
                                <Power className="text-muted-foreground" />
                              </Button>
                            }
                          />
                          <ConfirmButton action={deleteSupplier.bind(null, s.id)} title="¿Eliminar proveedor?" />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5}>Saldo total</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(totalBalance)}</TableCell>
                {canEdit && <TableCell />}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </>
  );
}
