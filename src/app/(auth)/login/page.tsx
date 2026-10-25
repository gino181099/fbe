import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/permissions";
import { CredentialsForm } from "./credentials-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage() {
  // Solo se sale del login si la sesión corresponde a un usuario que existe en la base.
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Image src="/brand/frabel-logo-pdf.png" alt="Frabel" width={128} height={72} className="mx-auto mb-2 h-16 w-auto dark:hidden" priority />
          <Image src="/brand/frabel-logo-bw-web.png" alt="Frabel" width={128} height={72} className="mx-auto mb-2 hidden h-16 w-auto invert dark:block" priority />
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
