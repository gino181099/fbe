import type { Metadata } from "next";
import { asc, desc } from "drizzle-orm";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { type Level, type Module, MODULES, permissions, users } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { can, requirePermission } from "@/lib/permissions";
import { deleteUser, updateUserAccess } from "./actions";
import { UserAccessCells } from "./user-access-form";

export const metadata: Metadata = { title: "Usuarios" };

const MODULE_LABELS: Record<Module, string> = {
  contactos: "Contactos",
  ventas: "Ventas",
  finanzas: "Finanzas",
  usuarios: "Usuarios",
};

export default async function UsersPage() {
  const me = await requirePermission("usuarios");
  const [userRows, permRows] = await Promise.all([
    db.select().from(users).orderBy(desc(users.isAdmin), asc(users.status), asc(users.name)),
    db.select().from(permissions),
  ]);
  const canEdit = can(me, "usuarios", "edit");
  const pendingCount = userRows.filter((u) => u.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Usuarios y permisos"
        description="Quien ingresa con Google queda pendiente hasta que lo actives y le asignes permisos por módulo."
        actions={pendingCount > 0 && <Badge variant="destructive">{pendingCount} pendientes de aprobación</Badge>}
      />
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Estado</TableHead>
              {MODULES.map((m) => (
                <TableHead key={m}>{MODULE_LABELS[m]}</TableHead>
              ))}
              <TableHead />
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {userRows.map((u) => {
              const levels = Object.fromEntries(
                MODULES.map((m) => [m, permRows.find((p) => p.userId === u.id && p.module === m)?.level ?? "none"]),
              ) as Record<Module, Level>;
              const name = u.name ?? u.username ?? u.email ?? "Usuario";
              const locked = u.isAdmin || u.id === me.id || !canEdit;
              return (
                <TableRow key={u.id} className={u.status === "pending" ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-8">
                        {u.image && <AvatarImage src={u.image} alt="" />}
                        <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="grid text-sm leading-tight">
                        <span className="font-medium">
                          {name} {u.isAdmin && <Badge className="ml-1">Admin</Badge>}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {u.email ?? `usuario: ${u.username}`} · alta {formatDate(u.createdAt.toISOString())}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  {u.isAdmin ? (
                    <TableCell colSpan={MODULES.length + 2} className="text-sm text-muted-foreground">
                      Acceso total a todos los módulos.
                    </TableCell>
                  ) : (
                    <UserAccessCells
                      // Remonta la fila cuando cambian los valores guardados (el form se resetea tras la acción).
                      key={[u.status, ...MODULES.map((m) => levels[m])].join("|")}
                      formId={`user-${u.id}`}
                      modules={MODULES}
                      status={u.status}
                      levels={levels}
                      action={updateUserAccess.bind(null, u.id)}
                      disabled={locked}
                    />
                  )}
                  <TableCell>
                    {!locked && (
                      <ConfirmButton
                        action={deleteUser.bind(null, u.id)}
                        title={`¿Eliminar a ${name}?`}
                        description="Podrá volver a ingresar con Google, pero quedará pendiente de aprobación."
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
