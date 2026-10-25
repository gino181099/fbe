import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/permissions";
import { CredentialsForm } from "./credentials-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage() {
  // Solo se sale del login si la sesión corresponde a un usuario que existe en la base.
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bus className="size-5" />
          </div>
          <CardTitle className="text-xl">Frabel ERP</CardTitle>
          <CardDescription>Elegí tu usuario e ingresá la clave</CardDescription>
        </CardHeader>
        <CardContent>
          <CredentialsForm />
        </CardContent>
      </Card>
    </main>
  );
}
