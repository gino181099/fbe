import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sin acceso" };

export default function NoAccessPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <ShieldX className="mx-auto mb-2 size-8 text-muted-foreground" />
          <CardTitle>Sin acceso</CardTitle>
          <CardDescription>No tenés permiso para ver esta sección. Pedile acceso al administrador.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
