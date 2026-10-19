"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bus, LayoutDashboard, LogOut, Receipt, Route, ShieldCheck, Truck, Users } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { Level, Module } from "@/db/schema";

type NavItem = {
  title: string;
  href: string;
  icon: typeof Bus;
  module?: Module;
  children?: { title: string; href: string }[];
};

const NAV: NavItem[] = [
  { title: "Inicio", href: "/", icon: LayoutDashboard },
  { title: "Contactos", href: "/contactos", icon: Users, module: "contactos" },
  { title: "Ventas", href: "/ventas", icon: Route, module: "ventas" },
  { title: "Flota", href: "/flota", icon: Truck, module: "ventas" },
  {
    title: "Finanzas",
    href: "/finanzas",
    icon: Receipt,
    module: "finanzas",
    children: [
      { title: "Cuentas corrientes", href: "/finanzas" },
      { title: "Comprobantes", href: "/finanzas/comprobantes" },
      { title: "Cobros", href: "/finanzas/cobros" },
      { title: "Gastos", href: "/finanzas/gastos" },
    ],
  },
  { title: "Usuarios", href: "/usuarios", icon: ShieldCheck, module: "usuarios" },
];

type Props = {
  user: { name: string | null; email: string | null; image: string | null; username: string | null };
  permissions: Record<Module, Level>;
};

export function AppSidebar({ user, permissions }: Props) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const items = NAV.filter((i) => !i.module || permissions[i.module] !== "none");
  const displayName = user.name ?? user.username ?? user.email ?? "Usuario";

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Bus className="size-4" />
                </div>
                <div className="grid leading-tight">
                  <span className="font-semibold">Frabel</span>
                  <span className="text-xs text-muted-foreground">ERP</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.title}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
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
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-md p-2">
          <Avatar className="size-8">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 text-sm leading-tight">
            <span className="truncate font-medium">{displayName}</span>
            {user.email && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
          </div>
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
