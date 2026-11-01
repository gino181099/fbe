"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, DatabaseBackup, LayoutDashboard, LogOut, type LucideIcon, Receipt, Route, Target, Truck, Users } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { PushToggle } from "@/components/push-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenuBadge,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { Level, Module } from "@/db/schema";
import { DB_DOWNLOAD_USERS } from "@/lib/constants";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  module?: Module;
  children?: { title: string; href: string }[];
};

// Usuarios no se muestra: con la clave única todos entran con el mismo usuario (la pantalla sigue en /usuarios).
const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Principal",
    items: [
      { title: "Inicio", href: "/", icon: LayoutDashboard },
      { title: "Agenda", href: "/agenda", icon: CalendarCheck },
    ],
  },
  {
    label: "Comercial",
    items: [
      { title: "Contactos", href: "/contactos", icon: Users, module: "contactos" },
      { title: "Leads", href: "/leads", icon: Target, module: "leads" },
    ],
  },
  {
    label: "Operación",
    items: [
      { title: "Ventas", href: "/ventas", icon: Route, module: "ventas" },
      { title: "Flota", href: "/flota", icon: Truck, module: "ventas" },
    ],
  },
  {
    label: "Administración",
    items: [
      {
        title: "Finanzas",
        href: "/finanzas",
        icon: Receipt,
        module: "finanzas",
        children: [
          { title: "Cuentas corrientes", href: "/finanzas" },
          { title: "Comprobantes", href: "/finanzas/comprobantes" },
          { title: "Recibos", href: "/finanzas/recibos" },
          { title: "Cobros (historial)", href: "/finanzas/cobros" },
          { title: "Gastos", href: "/finanzas/gastos" },
          { title: "Proveedores", href: "/finanzas/proveedores" },
        ],
      },
    ],
  },
];


type Props = {
  user: { name: string | null; email: string | null; image: string | null; username: string | null };
  permissions: Record<Module, Level>;
  /** Actividades propias vencidas o para hoy (número junto a Agenda). */
  dueActivities: number;
};

export function AppSidebar({ user, permissions, dueActivities }: Props) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.module || permissions[i.module] !== "none") })).filter(
    (g) => g.items.length > 0,
  );
  const displayName = user.name ?? user.username ?? user.email ?? "Usuario";

  return (
    <Sidebar collapsible="icon">
      {/* Comprimido (botón o Ctrl+B): solo íconos con su nombre al pasar el mouse; se recuerda en una cookie. */}
      <SidebarHeader className="flex-row items-center justify-between border-b px-4 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <Link href="/" className="flex items-center group-data-[collapsible=icon]:hidden">
          {/* Claro: logo color · oscuro: blanco y negro invertido (queda blanco). */}
          <Image src="/brand/frabel-logo-pdf.png" alt="Frabel" width={128} height={72} className="h-12 w-auto dark:hidden" priority />
          <Image src="/brand/frabel-logo-bw-web.png" alt="Frabel" width={128} height={72} className="hidden h-12 w-auto invert dark:block" priority />
        </Link>
        <SidebarTrigger className="hidden text-muted-foreground md:inline-flex" title="Comprimir / expandir el menú (Ctrl+B)" />
      </SidebarHeader>
      <SidebarContent className="py-2">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[11px] font-semibold tracking-wide uppercase">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.href === "/agenda" && dueActivities > 0 && (
                      <SidebarMenuBadge className="bg-destructive/10 text-destructive">{dueActivities}</SidebarMenuBadge>
                    )}
                    {item.children && isActive(item.href) && (
                      <SidebarMenuSub>
                        {item.children.map((child) => (
                          <SidebarMenuSubItem key={child.href}>
                            <SidebarMenuSubButton asChild isActive={pathname === child.href}>
                              <Link href={child.href}>{child.title}</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="flex items-center gap-2 rounded-md p-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:p-0">
          <Avatar className="size-8">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback className="bg-primary/10 font-medium text-primary">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-medium">{displayName}</span>
            {user.email && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
          </div>
          {DB_DOWNLOAD_USERS.includes(user.username ?? "") && (
            // Copia completa de la base (para guardarla en otra PC); <a> y no <Link>: es una descarga.
            <a
              href="/api/copia-base"
              download
              className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              title="Descargar copia de la base"
              aria-label="Descargar copia de la base"
            >
              <DatabaseBackup className="size-4" />
            </a>
          )}
          <PushToggle />
          <ThemeToggle />
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              title="Cerrar sesión"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
