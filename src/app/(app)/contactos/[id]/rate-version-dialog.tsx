"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Download, FilePlus2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { parseAmount } from "@/lib/parse-amount";
import { type RateVersionInput, saveRateVersion } from "../actions";

type CurrentRate = { routeId: number; routeName: string; capacity: number; price: number };
type Row = {
  key: string;
  routeId?: number;
  routeName: string;
  capacity: string;
  current?: number;
  price: string;
};

const NEW_ROUTE = "__new__";

const toNumber = parseAmount;

let seq = 0;
const nextKey = () => `row-${++seq}`;

/**
 * Nueva versión del tarifario: precarga las tarifas vigentes, se editan los precios
 * a mano (o se completan desde una planilla) y se elige desde qué fecha rigen.
 */
export function RateVersionDialog({
  clientId,
  clientName,
  current,
  routes,
  defaultDate,
}: {
  clientId: number;
  clientName: string;
  current: CurrentRate[];
  routes: { id: number; name: string }[];
  defaultDate: string;
}) {
  const initialRows = (): Row[] =>
    current.map((r) => ({
      key: nextKey(),
      routeId: r.routeId,
      routeName: r.routeName,
      capacity: String(r.capacity),
      current: r.price,
      price: String(r.price),
    }));

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [validFrom, setValidFrom] = useState(defaultDate);
  const [recalculate, setRecalculate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const onOpenChange = (next: boolean) => {
    if (next) {
      setRows(initialRows());
      setValidFrom(defaultDate);
      setRecalculate(false);
      setError(null);
    }
    setOpen(next);
  };

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const changed = useMemo(
    () => rows.filter((r) => r.current === undefined || toNumber(r.price) !== r.current),
    [rows],
  );

  const routeByName = useMemo(
    () => new Map(routes.map((r) => [r.name.toLocaleLowerCase("es"), r])),
    [routes],
  );

  async function importFile(file: File) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const pick = (row: Record<string, unknown>, names: string[]) => {
      const key = Object.keys(row).find((k) => names.includes(k.trim().toLowerCase()));
      return key ? String(row[key]).trim() : "";
    };
    let applied = 0;
    const next = rows.map((r) => ({ ...r }));
    for (const raw of data) {
      const routeName = pick(raw, ["recorrido", "ruta", "route"]);
      const capacity = pick(raw, ["capacidad", "plazas", "categoria", "categoría"]);
      const price = pick(raw, ["precio", "tarifa", "price", "precio nuevo"]);
      if (!routeName || !capacity || !price) continue;
      applied++;
      const existing = next.find(
        (r) => r.routeName.toLowerCase() === routeName.toLowerCase() && r.capacity === capacity,
      );
      if (existing) existing.price = price;
      else {
        const known = routeByName.get(routeName.toLocaleLowerCase("es"));
        next.push({ key: nextKey(), routeId: known?.id, routeName: known?.name ?? routeName, capacity, price });
      }
    }
    setRows(next);
    if (applied) toast.success(`${applied} filas leídas de ${file.name}`);
    else toast.error("No se encontraron columnas Recorrido / Capacidad / Precio en el archivo.");
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => ({ Recorrido: r.routeName, Capacidad: Number(r.capacity) || "", Precio: toNumber(r.price) ?? "" })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tarifario");
    XLSX.writeFile(wb, `tarifario-${clientName}.xlsx`);
  }

  function submit() {
    setError(null);
    const items: RateVersionInput["items"] = [];
    for (const r of changed) {
      const capacity = Number(r.capacity);
      const price = toNumber(r.price);
      if (!r.routeName.trim()) return setError("Hay filas sin recorrido.");
      if (!Number.isInteger(capacity) || capacity <= 0) return setError(`Capacidad inválida en ${r.routeName}.`);
      if (price === null || price < 0) return setError(`Precio inválido en ${r.routeName} (${r.capacity}).`);
      items.push(
        r.routeId ? { routeId: r.routeId, capacity, price } : { routeName: r.routeName.trim(), capacity, price },
      );
    }
    if (items.length === 0) return setError("No cambiaste ningún precio.");
    startTransition(async () => {
      const res = await saveRateVersion(clientId, { validFrom, recalculate, items });
      if (res.ok) {
        toast.success(res.message ?? "Tarifario guardado");
        setOpen(false);
      } else setError(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <FilePlus2 /> Nueva versión del tarifario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nueva versión del tarifario</DialogTitle>
          <DialogDescription>
            Escribí los precios nuevos. Las tarifas que cambies se cierran el día anterior a la fecha de vigencia y
            quedan en el historial; los recorridos ya cargados conservan su precio.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="validFrom">Vigente desde</Label>
            <Input id="validFrom" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              <Download /> Descargar planilla
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload /> Cargar Excel / CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recorrido</TableHead>
                <TableHead className="w-24">Capacidad</TableHead>
                <TableHead className="text-right">Precio actual</TableHead>
                <TableHead className="w-40">Precio nuevo</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const isChanged = r.current === undefined || toNumber(r.price) !== r.current;
                return (
                  <TableRow key={r.key} data-state={isChanged ? "selected" : undefined}>
                    <TableCell>
                      {r.current !== undefined ? (
                        r.routeName
                      ) : (
                        <RoutePicker
                          routes={routes}
                          value={r}
                          onChange={(patch) => update(r.key, patch)}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {r.current !== undefined ? (
                        r.capacity
                      ) : (
                        <Input
                          inputMode="numeric"
                          value={r.capacity}
                          onChange={(e) => update(r.key, { capacity: e.target.value })}
                          placeholder="14"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {r.current !== undefined ? formatMoney(r.current) : "Nueva"}
                    </TableCell>
                    <TableCell>
                      <Input
                        inputMode="decimal"
                        value={r.price}
                        onChange={(e) => update(r.key, { price: e.target.value })}
                        className="text-right tabular-nums"
                        aria-label={`Precio nuevo ${r.routeName} ${r.capacity}`}
                      />
                    </TableCell>
                    <TableCell>
                      {r.current === undefined && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Quitar fila"
                          onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setRows((rs) => [...rs, { key: nextKey(), routeName: "", capacity: "", price: "" }])}
        >
          <Plus /> Agregar recorrido / capacidad
        </Button>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={recalculate} onCheckedChange={(v) => setRecalculate(v === true)} className="mt-0.5" />
          <span>
            Recalcular el precio de los recorridos ya cargados desde el {validFrom.split("-").reverse().join("/")}
            <span className="block text-xs text-muted-foreground">
              Útil si cargaste viajes antes de actualizar el tarifario.
            </span>
          </span>
        </label>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <span className="mr-auto self-center text-sm text-muted-foreground">
            {changed.length} {changed.length === 1 ? "tarifa cambia" : "tarifas cambian"}
          </span>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || !validFrom}>
            {pending ? "Guardando…" : "Guardar versión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoutePicker({
  routes,
  value,
  onChange,
}: {
  routes: { id: number; name: string }[];
  value: Row;
  onChange: (patch: Partial<Row>) => void;
}) {
  const [custom, setCustom] = useState(!value.routeId && value.routeName !== "");
  if (custom) {
    return (
      <Input
        value={value.routeName}
        onChange={(e) => onChange({ routeName: e.target.value, routeId: undefined })}
        placeholder="Nombre del recorrido"
        autoFocus
      />
    );
  }
  return (
    <NativeSelect
      className="w-full"
      value={value.routeId ? String(value.routeId) : ""}
      onChange={(e) => {
        if (e.target.value === NEW_ROUTE) {
          setCustom(true);
          onChange({ routeId: undefined, routeName: "" });
          return;
        }
        const r = routes.find((x) => x.id === Number(e.target.value));
        onChange({ routeId: r?.id, routeName: r?.name ?? "" });
      }}
    >
      <NativeSelectOption value="">Elegir…</NativeSelectOption>
      {routes.map((r) => (
        <NativeSelectOption key={r.id} value={r.id}>
          {r.name}
        </NativeSelectOption>
      ))}
      <NativeSelectOption value={NEW_ROUTE}>+ Recorrido nuevo…</NativeSelectOption>
    </NativeSelect>
  );
}
