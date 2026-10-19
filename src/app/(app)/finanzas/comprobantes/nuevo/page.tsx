import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { CC_START, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "@/lib/constants";
import { formatDocNumber } from "@/lib/doc-number";
import { allowsRelated, usesTrips } from "@/lib/document-rules";
import { getUninvoicedTrips, listDocuments, nextInternalNumber } from "@/lib/documents";
import { formatDate, formatMoney, today } from "@/lib/format";
import { requirePermission } from "@/lib/permissions";
import { DocumentForm } from "./document-form";

export const metadata: Metadata = { title: "Nuevo comprobante" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function NewDocumentPage({ searchParams }: PageProps<"/finanzas/comprobantes/nuevo">) {
  await requirePermission("finanzas", "edit");
  const sp = await searchParams;
  const clienteId = Number(str(sp.cliente)) || undefined;
  const tipo = DOCUMENT_TYPES.find((t) => t === str(sp.tipo));
  const desde = isDate(str(sp.desde));
  const hasta = isDate(str(sp.hasta));

  const clientList = await db
    .select({ id: clients.id, name: clients.name, paymentDays: clients.paymentDays })
    .from(clients)
    .orderBy(asc(clients.name));
  const client = clientList.find((c) => c.id === clienteId);

  const ready = client && tipo;
  const [tripRows, related, nextNumber] = ready
    ? await Promise.all([
        usesTrips(tipo) ? getUninvoicedTrips(client.id, desde, hasta) : [],
        allowsRelated(tipo) ? listDocuments({ clientId: client.id, status: "vigentes" }) : [],
        tipo === "interno" ? nextInternalNumber() : null,
      ])
    : [[], [], null];

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href={client ? `/finanzas/cuentas/${client.id}` : "/finanzas/comprobantes"}>
          <ArrowLeft /> {client ? `Cuenta de ${client.name}` : "Comprobantes"}
        </Link>
      </Button>
      <PageHeader
        title="Nuevo comprobante"
        description={`Elegí cliente y tipo. Factura y comprobante interno documentan recorridos desde el ${formatDate(CC_START)}; lo anterior va como saldo inicial.`}
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
        <label className="grid gap-1 text-xs text-muted-foreground">
          Tipo
          <NativeSelect name="tipo" defaultValue={tipo ?? ""} required>
            <NativeSelectOption value="">Elegir…</NativeSelectOption>
            {DOCUMENT_TYPES.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        {(!tipo || usesTrips(tipo)) && (
          <>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Recorridos desde
              <Input type="date" name="desde" defaultValue={desde} min={CC_START} className="w-40" />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Hasta
              <Input type="date" name="hasta" defaultValue={hasta} className="w-40" />
            </label>
          </>
        )}
        <Button type="submit" variant="secondary">
          Continuar
        </Button>
      </form>

      {!ready ? (
        <EmptyState>Elegí un cliente y el tipo de comprobante.</EmptyState>
      ) : (
        <DocumentForm
          key={`${client.id}-${tipo}-${desde ?? ""}-${hasta ?? ""}`}
          clientId={client.id}
          type={tipo}
          paymentDays={client.paymentDays}
          defaultDate={today()}
          nextNumber={nextNumber}
          trips={tripRows.map((t) => ({
            id: t.id,
            date: t.date,
            dateLabel: formatDate(t.date),
            route: t.route ?? t.routeText ?? "Recorrido",
            capacity: t.capacity,
            passengers: t.passengers,
            price: t.price,
            priceLabel: formatMoney(t.price),
          }))}
          related={related.map(({ d }) => ({
            id: d.id,
            label: [DOCUMENT_TYPE_LABELS[d.type], formatDocNumber(d.letter, d.pos, d.number), "·", formatDate(d.date), "·", formatMoney(d.amount)]
              .filter(Boolean)
              .join(" "),
          }))}
        />
      )}
    </>
  );
}
