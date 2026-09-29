import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/permissions";
import { logout } from "../actions";

export const metadata: Metadata = { title: "Acceso pendiente" };

export default async function PendingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status === "active") redirect("/");
  const disabled = user.status === "disabled";
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <Clock className="mx-auto mb-2 size-8 text-muted-foreground" />
          <CardTitle>{disabled ? "Cuenta deshabilitada" : "Pendiente de aprobación"}</CardTitle>
          <CardDescription>
            {disabled
              ? "Tu cuenta fue deshabilitada. Contactá al administrador."
              : `Hola ${user.name ?? user.email}. Un administrador tiene que habilitar tu cuenta y asignarte permisos.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={logout}>
            <Button variant="outline" type="submit">
              Cerrar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
