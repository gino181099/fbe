"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/constants";
import { formatDocNumber } from "@/lib/doc-number";
import {
  DOCUMENT_LETTERS,
  allowsRelated,
  hasDueDate,
  itemsTotal,
  usesFreeItems,
  usesSingleAmount,
  usesTrips,
} from "@/lib/document-rules";
import { formatMoney } from "@/lib/format";
import { addDays } from "@/lib/ledger";
import { parseAmount } from "@/lib/parse-amount";
import { type DocumentInput, createDocument } from "../actions";

type TripOption = {
  id: number;
  date: string;
  dateLabel: string;
  route: string;
  capacity: number | null;
  passengers: number | null;
  price: number;
  priceLabel: string;
};

type ItemRow = { key: string; date: string; description: string; amount: string };

let seq = 0;
const nextKey = () => `item-${++seq}`;
const toInt = (v: string) => (v.trim() === "" ? null : Number(v));

/** Formulario de alta de comprobante según el tipo (recorridos tildados o ítems libres). */
export function DocumentForm({
  clientId,
  type,
  paymentDays,
  defaultDate,
  nextNumber,
  trips,
  related,
}: {
  clientId: number;
  type: DocumentType;
  paymentDays: number;
  defaultDate: string;
  nextNumber: number | null;
  trips: TripOption[];
  related: { id: number; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [date, setDate] = useState(defaultDate);
  const defaultDue = usesTrips(type) ? addDays(defaultDate, paymentDays) : "";
  const [dueDate, setDueDate] = useState(defaultDue);
  const [dueTouched, setDueTouched] = useState(false);
  const letters = DOCUMENT_LETTERS[type];
  const [letter, setLetter] = useState(type === "factura" ? "A" : type === "interno" ? "X" : "");
  const [pos, setPos] = useState(type === "factura" ? "1" : "");
  const [number, setNumber] = useState("");
  const [relatedId, setRelatedId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>(() =>
    usesFreeItems(type) ? [{ key: nextKey(), date: defaultDate, description: "", amount: "" }] : [],
  );
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");

  const total = useMemo(() => {
    if (usesTrips(type)) return itemsTotal(trips.filter((t) => selected.has(t.id)).map((t) => ({ amount: t.price })));
    if (usesSingleAmount(type)) return parseAmount(amount) ?? 0;
    return itemsTotal(items.map((i) => ({ amount: parseAmount(i.amount) ?? 0 })));
  }, [type, trips, selected, amount, items]);

  const changeDate = (v: string) => {
    setDate(v);
    if (usesTrips(type) && !dueTouched && /^\d{4}-\d{2}-\d{2}$/.test(v)) setDueDate(addDays(v, paymentDays));
  };
  const toggle = (id: number, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allSelected = trips.length > 0 && selected.size === trips.length;
  const updateItem = (key: string, patch: Partial<ItemRow>) =>
    setItems((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function submit() {
    setError(null);
    let docItems: DocumentInput["items"] = [];
    if (usesFreeItems(type)) {
      for (const [i, r] of items.entries()) {
        const value = parseAmount(r.amount);
        if (value === null) return setError(`Monto inválido en el ítem ${i + 1}.`);
        docItems.push({ date: r.date, description: r.description, amount: value });
      }
    } else if (usesSingleAmount(type)) {
      const value = parseAmount(amount);
      if (value === null) return setError("Monto inválido.");
      docItems = [{ date, description: concept, amount: value }];
    }
    const posValue = type === "interno" ? null : toInt(pos);
    const numberValue = type === "interno" ? null : toInt(number);
    if ((posValue !== null && !Number.isInteger(posValue)) || (numberValue !== null && !Number.isInteger(numberValue))) {
      return setError("El punto de venta y el número son enteros.");
    }
    const input: DocumentInput = {
      clientId,
      type,
      date,
      dueDate: hasDueDate(type) && dueDate ? dueDate : null,
      letter: letters.length ? letter || null : null,
      pos: posValue,
      number: numberValue,
      relatedDocumentId: allowsRelated(type) && relatedId ? Number(relatedId) : null,
      notes: notes || null,
      tripIds: usesTrips(type) ? trips.filter((t) => selected.has(t.id)).map((t) => t.id) : [],
      items: docItems,
    };
    startTransition(async () => {
      const res = await createDocument(input);
      if (res.ok) {
        toast.success(res.message ?? "Comprobante registrado");
        router.push(`/finanzas/cuentas/${clientId}`);
      } else setError(res.error);
    });
  }

  return (
    <div className="grid gap-6 surface p-4 sm:p-6">
      <h2 className="text-lg font-semibold">{DOCUMENT_TYPE_LABELS[type]}</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Fecha" htmlFor="date">
          <Input id="date" type="date" value={date} onChange={(e) => changeDate(e.target.value)} required />
        </Field>
        {hasDueDate(type) && (
          <Field
            label={type === "nota_debito" ? "Vencimiento (opcional)" : "Vencimiento"}
            htmlFor="dueDate"
            hint={usesTrips(type) ? `Por defecto: fecha + ${paymentDays} días.` : undefined}
          >
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setDueTouched(true);
              }}
            />
          </Field>
        )}
        {type === "interno" ? (
          <Field label="Número" hint="Automático al guardar.">
            <Input value={formatDocNumber("X", 1, nextNumber)} readOnly disabled />
          </Field>
        ) : (
          letters.length > 0 && (
            <>
              <Field label={type === "factura" ? "Letra" : "Letra (opcional)"} htmlFor="letter">
                <NativeSelect id="letter" className="w-full" value={letter} onChange={(e) => setLetter(e.target.value)}>
                  {type !== "factura" && <NativeSelectOption value="">—</NativeSelectOption>}
                  {letters.map((l) => (
                    <NativeSelectOption key={l} value={l}>
                      {l}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <div className="grid grid-cols-[2fr_3fr] gap-2">
                <Field label="Pto. venta" htmlFor="pos">
                  <Input
                    id="pos"
                    inputMode="numeric"
                    value={pos}
                    onChange={(e) => setPos(e.target.value)}
                    placeholder="1"
                    required={type === "factura"}
                  />
                </Field>
                <Field label={type === "factura" ? "Número" : "Número (opc.)"} htmlFor="number">
                  <Input
                    id="number"
                    inputMode="numeric"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    required={type === "factura"}
                  />
                </Field>
              </div>
            </>
          )
        )}
        {allowsRelated(type) && (
          <Field label="Comprobante relacionado (opcional)" htmlFor="related" className="sm:col-span-2">
            <NativeSelect id="related" className="w-full" value={relatedId} onChange={(e) => setRelatedId(e.target.value)}>
              <NativeSelectOption value="">Ninguno</NativeSelectOption>
              {related.map((r) => (
                <NativeSelectOption key={r.id} value={r.id}>
                  {r.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>

      {usesTrips(type) &&
        (trips.length === 0 ? (
          <Alert>
            <AlertDescription>No hay recorridos sin comprobante para este cliente en el período.</AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(v) => setSelected(v === true ? new Set(trips.map((t) => t.id)) : new Set())}
                      aria-label="Tildar todos"
                    />
                  </TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Recorrido</TableHead>
                  <TableHead className="text-right">Capacidad</TableHead>
                  <TableHead className="text-right">Pax</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((t) => (
                  <TableRow key={t.id} data-state={selected.has(t.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(t.id)}
                        onCheckedChange={(v) => toggle(t.id, v === true)}
                        aria-label={`Incluir recorrido del ${t.dateLabel}`}
                      />
                    </TableCell>
                    <TableCell>{t.dateLabel}</TableCell>
                    <TableCell>{t.route}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.capacity ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.passengers ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.priceLabel}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>
                    {selected.size} de {trips.length} recorridos tildados
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ))}

      {usesFreeItems(type) && (
        <div className="grid gap-2">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Fecha</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="w-44 text-right">Monto</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r, i) => (
                  <TableRow key={r.key}>
                    <TableCell>
                      <Input
                        type="date"
                        value={r.date}
                        onChange={(e) => updateItem(r.key, { date: e.target.value })}
                        aria-label={`Fecha ítem ${i + 1}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={r.description}
                        onChange={(e) => updateItem(r.key, { description: e.target.value })}
                        placeholder={type === "saldo_inicial" ? "Ej.: Saldo septiembre 2026" : "Ej.: Espera adicional"}
                        aria-label={`Detalle ítem ${i + 1}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        inputMode="decimal"
                        value={r.amount}
                        onChange={(e) => updateItem(r.key, { amount: e.target.value })}
                        className="text-right tabular-nums"
                        aria-label={`Monto ítem ${i + 1}`}
                      />
                    </TableCell>
                    <TableCell>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Quitar ítem"
                          onClick={() => setItems((rs) => rs.filter((x) => x.key !== r.key))}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(total)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() =>
              setItems((rs) => [...rs, { key: nextKey(), date: rs.at(-1)?.date ?? date, description: "", amount: "" }])
            }
          >
            <Plus /> Agregar ítem
          </Button>
        </div>
      )}

      {usesSingleAmount(type) && (
        <div className="grid gap-4 sm:grid-cols-[3fr_1fr]">
          <Field label="Concepto" htmlFor="concept">
            <Input
              id="concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder={type === "bonificacion" ? "Ej.: Bonificación por volumen" : "Ej.: Descuento acordado"}
              required
            />
          </Field>
          <Field label="Monto" htmlFor="amount">
            <Input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-right tabular-nums"
              required
            />
          </Field>
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
          Total: <span className="font-semibold text-foreground tabular-nums">{formatMoney(total)}</span>
        </span>
        <Button variant="outline" onClick={() => router.push(`/finanzas/cuentas/${clientId}`)} disabled={pending}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
