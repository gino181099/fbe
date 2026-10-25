"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Field } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { parseAmount } from "@/lib/parse-amount";
import { createReceipt } from "../actions";

type TripOption = {
  id: number;
  dateLabel: string;
  description: string;
  priceLabel: string;
  remaining: number;
  remainingLabel: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
// Formato que `parseAmount` vuelve a leer ("1.500,5").
const amountInput = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/** Alta de recibo: recorridos pendientes tildables (suman su pendiente) y monto editable (≥ Σ tildados). */
export function ReceiptForm({
  clientId,
  clientName,
  balanceLabel,
  numberLabel,
  defaultDate,
  minDate,
  trips,
}: {
  clientId: number;
  clientName: string;
  balanceLabel: string;
  numberLabel: string;
  defaultDate: string;
  minDate: string;
  trips: TripOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [date, setDate] = useState(defaultDate);
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");

  const sumOf = (ids: Set<number>) => round2(trips.reduce((s, t) => s + (ids.has(t.id) ? t.remaining : 0), 0));
  const selectedTotal = sumOf(selected);
  const parsedAmount = parseAmount(amount);
  const extra = parsedAmount != null ? round2(parsedAmount - selectedTotal) : 0;

  function select(next: Set<number>) {
    setSelected(next);
    const sum = sumOf(next);
    // El monto sigue a lo tildado salvo que se haya escrito uno mayor a mano.
    if (!amountTouched || (parseAmount(amount) ?? 0) < sum) {
      setAmount(sum ? amountInput.format(sum) : "");
      setAmountTouched(false);
    }
  }
  const toggle = (id: number, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    select(next);
  };
  const allSelected = trips.length > 0 && selected.size === trips.length;

  function submit() {
    setError(null);
    const value = parseAmount(amount);
    if (value === null || value <= 0) return setError("Ingresá un monto mayor a 0.");
    if (round2(value) < selectedTotal) return setError("El monto no puede ser menor que la suma de los recorridos tildados.");
    startTransition(async () => {
      const res = await createReceipt({
        clientId,
        date,
        amount: value,
        method: method || null,
        notes: notes || null,
        trips: trips.filter((t) => selected.has(t.id)).map((t) => ({ tripId: t.id, amount: t.remaining })),
      });
      if (res.ok) {
        toast.success(res.message ?? "Recibo registrado");
        router.push(`/finanzas/recibos?nuevo=${res.id}`);
      } else setError(res.error);
    });
  }

  return (
    <div className="grid gap-6 surface p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Recibo para {clientName}</h2>
        <span className="text-sm text-muted-foreground">{balanceLabel}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Número" hint="Automático al guardar.">
          <Input value={numberLabel} readOnly disabled />
        </Field>
        <Field label="Fecha" htmlFor="date">
          <Input id="date" type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Medio de pago" htmlFor="method">
          <Input id="method" list="methods" value={method} onChange={(e) => setMethod(e.target.value)} maxLength={100} />
          <datalist id="methods">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <Field
          label="Monto"
          htmlFor="amount"
          hint={
            selected.size && extra > 0.004
              ? `${formatMoney(extra)} a cuenta del saldo (se aplica a lo más viejo).`
              : selected.size
                ? "Igual a lo tildado; podés poner más."
                : "Sin recorridos tildados: se aplica a lo más viejo."
          }
        >
          <Input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setAmountTouched(true);
            }}
            className="text-right tabular-nums"
            required
          />
        </Field>
      </div>

      {trips.length === 0 ? (
        <Alert>
          <AlertDescription>No hay recorridos pendientes de cobro: el recibo queda a cuenta del saldo.</AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => select(v === true ? new Set(trips.map((t) => t.id)) : new Set())}
                    aria-label="Tildar todos"
                  />
                </TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((t) => (
                <TableRow key={t.id} data-state={selected.has(t.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(t.id)}
                      onCheckedChange={(v) => toggle(t.id, v === true)}
                      aria-label={`Pagar recorrido del ${t.dateLabel}`}
                    />
                  </TableCell>
                  <TableCell>{t.dateLabel}</TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.priceLabel}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.remainingLabel}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>
                  {selected.size} de {trips.length} recorridos tildados
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(selectedTotal)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      <Field label="Observaciones (opcional)" htmlFor="notes">
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={2} />
      </Field>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="mr-auto text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground tabular-nums">{formatMoney(parsedAmount ?? 0)}</span>
        </span>
        <Button variant="outline" onClick={() => router.push(`/finanzas/cuentas/${clientId}`)} disabled={pending}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Guardando…" : "Guardar recibo"}
        </Button>
      </div>
    </div>
  );
}
