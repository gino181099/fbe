import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { CC_START } from "@/lib/constants";
import { formatReceiptNumber } from "@/lib/doc-number";
import { formatDate, formatMoney, today } from "@/lib/format";
import { requirePermission } from "@/lib/permissions";
import { getPendingTrips, nextReceiptNumber } from "@/lib/receipts";
import { ReceiptForm } from "./receipt-form";

export const metadata: Metadata = { title: "Nuevo recibo" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export default async function NewReceiptPage({ searchParams }: PageProps<"/finanzas/recibos/nuevo">) {
  await requirePermission("finanzas", "edit");
  const sp = await searchParams;
  const clienteId = Number(str(sp.cliente)) || undefined;

  const [clientList, data, nextNumber] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name)),
    clienteId ? getPendingTrips(clienteId) : null,
    nextReceiptNumber(),
  ]);
  const todayIso = today();

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href={data ? `/finanzas/cuentas/${data.client.id}` : "/finanzas/recibos"}>
          <ArrowLeft /> {data ? `Cuenta de ${data.client.name}` : "Recibos"}
        </Link>
      </Button>
      <PageHeader help="recibos"
        title="Nuevo recibo"
        description="Tildá los recorridos que paga el cliente o cargá un monto libre: lo que no se asigne se aplica a lo más viejo."
      />

      <form className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Cliente
          <NativeSelect name="cliente" defaultValue={clienteId ?? ""} required>
            <NativeSelectOption value="">Elegir…</NativeSelectOption>
            {clientList.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit" variant="secondary">
          Continuar
        </Button>
      </form>

      {!data ? (
        <EmptyState>Elegí un cliente.</EmptyState>
      ) : (
        <ReceiptForm
          key={`${data.client.id}-${nextNumber}`}
          clientId={data.client.id}
          clientName={data.client.name}
          balanceLabel={
            data.balance >= 0
              ? `Saldo a cobrar: ${formatMoney(data.balance)}`
              : `Saldo a favor del cliente: ${formatMoney(-data.balance)}`
          }
          numberLabel={formatReceiptNumber(nextNumber)}
          defaultDate={todayIso < CC_START ? CC_START : todayIso}
          minDate={CC_START}
          trips={data.trips.map((t) => ({
            id: t.tripId,
            dateLabel: formatDate(t.date),
            description: t.description,
            priceLabel: formatMoney(t.amount),
            remaining: t.remaining,
            remainingLabel: formatMoney(t.remaining),
          }))}
        />
      )}
    </>
  );
}
