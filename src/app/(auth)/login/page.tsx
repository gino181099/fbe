import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/permissions";
import { loginWithGoogle } from "../actions";
import { CredentialsForm } from "./credentials-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage() {
  // Solo se sale del login si la sesión corresponde a un usuario que existe en la base.
  if (await getCurrentUser()) redirect("/");
  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bus className="size-5" />
          </div>
          <CardTitle className="text-xl">Frabel ERP</CardTitle>
          <CardDescription>Ingresá para continuar</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {googleEnabled && (
            <>
              <form action={loginWithGoogle}>
                <Button type="submit" variant="outline" className="w-full">
                  <GoogleIcon /> Continuar con Google
                </Button>
              </form>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Separator className="flex-1" /> o con usuario <Separator className="flex-1" />
              </div>
            </>
          )}
          <CredentialsForm />
        </CardContent>
      </Card>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
