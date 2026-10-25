"use client";

import { type ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import { FormDialog } from "@/components/form-dialog";
import { Field } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type ClientType, DEFAULT_FUEL_SUPPLIER, FUEL_SUPPLIERS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import type { ActionResult } from "@/lib/permissions";
import { getClientRates } from "./actions";

type ClientOption = { id: number; name: string; type: ClientType };
type RouteOption = { id: number; name: string };
export type DriverOption = { id: number; name: string; active: boolean };
export type VehicleOption = { id: number; plate: string; model: string; seats: number; active: boolean };
type Rate = Awaited<ReturnType<typeof getClientRates>>[number];

export type TripDefaults = {
  date: string;
  clientId?: number;
  routeId?: number | null;
  routeText?: string | null;
  passengers?: number | null;
  capacity?: number | null;
  price?: number | null;
  driver?: string | null;
  driverId?: number | null;
  vehicleId?: number | null;
  driverPay?: number | null;
  fuelPesos?: number | null;
  fuelLiters?: number | null;
  fuelSupplier?: string | null;
  extraPayments?: number | null;
  notes?: string | null;
};

type Props = {
  title: string;
  trigger: ReactNode;
  action: (formData: FormData) => Promise<ActionResult>;
  clients: ClientOption[];
  routes: RouteOption[];
  drivers: DriverOption[];
  vehicles: VehicleOption[];
  defaults: TripDefaults;
  /** Debajo de los campos (ej. quién lo cargó). */
  footer?: ReactNode;
};

export function TripFormDialog(props: Props) {
  return (
    <FormDialog title={props.title} trigger={props.trigger} action={props.action} className="sm:max-w-2xl">
      <TripFields {...props} />
      {props.footer}
    </FormDialog>
  );
}

function TripFields({ clients, routes, drivers, vehicles, defaults }: Props) {
  // Chofer cargado como texto que no se pudo asociar a la lista: se conserva tal cual.
  const historicDriver = !defaults.driverId && defaults.driver ? defaults.driver : null;
  const [date, setDate] = useState(defaults.date);
  const [clientId, setClientId] = useState(defaults.clientId ? String(defaults.clientId) : "");
  const [routeId, setRouteId] = useState(defaults.routeId ? String(defaults.routeId) : "");
  const [capacity, setCapacity] = useState(defaults.capacity ? String(defaults.capacity) : "");
  const [passengers, setPassengers] = useState(defaults.passengers ? String(defaults.passengers) : "");
  const [price, setPrice] = useState(defaults.price != null ? String(defaults.price) : "");
  const [priceTouched, setPriceTouched] = useState(defaults.price != null);
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, startLoading] = useTransition();

  const client = clients.find((c) => String(c.id) === clientId);
  const recurring = client?.type === "recurrente";

  useEffect(() => {
    if (!recurring || !date) return;
    startLoading(async () => setRates(await getClientRates(Number(clientId), date)));
  }, [recurring, clientId, date]);

  const activeRates = useMemo(() => (recurring ? rates : []), [recurring, rates]);
  const rateRoutes = useMemo(() => {
    const seen = new Map<number, string>();
    activeRates.forEach((r) => seen.set(r.routeId, r.routeName));
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [activeRates]);
  const capacities = activeRates.filter((r) => String(r.routeId) === routeId).map((r) => r.capacity);

  // Si no se eligió categoría, se sugiere la más chica que alcance para los pasajeros.
  const suggested =
    passengers && capacities.length
      ? (capacities.find((c) => c >= Number(passengers)) ?? capacities[capacities.length - 1])
      : undefined;
  const effectiveCapacity = recurring && !capacity && suggested ? String(suggested) : capacity;
  const rate = activeRates.find((r) => String(r.routeId) === routeId && String(r.capacity) === effectiveCapacity);

  // El precio sigue a la tarifa mientras no se haya escrito a mano.
  const effectivePrice = !priceTouched && rate ? String(rate.price) : price;

  const routeOptions = recurring ? rateRoutes : routes;

  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <Field label="Fecha" htmlFor="date" className="sm:col-span-2">
        <Input id="date" name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <Field label="Cliente" htmlFor="clientId" className="sm:col-span-4">
        <NativeSelect
          id="clientId"
          name="clientId"
          className="w-full"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setRouteId("");
            setCapacity("");
            setPriceTouched(false);
            setPrice("");
            setRates([]);
          }}
          required
        >
          <NativeSelectOption value="">Elegir cliente…</NativeSelectOption>
          <optgroup label="Recurrentes">
            {clients
              .filter((c) => c.type === "recurrente")
              .map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
          </optgroup>
          <optgroup label="Especiales">
            {clients
              .filter((c) => c.type === "especial")
              .map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
          </optgroup>
        </NativeSelect>
      </Field>

      <Field
        label="Recorrido"
        htmlFor="routeId"
        className="sm:col-span-3"
        hint={recurring && !loading && rateRoutes.length === 0 ? "El cliente no tiene tarifas vigentes en esa fecha." : undefined}
      >
        <NativeSelect
          id="routeId"
          name="routeId"
          className="w-full"
          value={routeId}
          onChange={(e) => {
            setRouteId(e.target.value);
            setCapacity("");
            setPriceTouched(false);
          }}
        >
          <NativeSelectOption value="">{recurring ? "Elegir recorrido…" : "Otro (escribir abajo)"}</NativeSelectOption>
          {routeOptions.map((r) => (
            <NativeSelectOption key={r.id} value={r.id}>
              {r.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {!routeId ? (
        <Field label="Descripción del recorrido" htmlFor="routeText" className="sm:col-span-3">
          <Input id="routeText" name="routeText" defaultValue={defaults.routeText ?? ""} placeholder="Ej.: San Juan" />
        </Field>
      ) : (
        <div className="hidden sm:col-span-3 sm:block" />
      )}

      <Field label="Pasajeros" htmlFor="passengers" className="sm:col-span-2">
        <Input
          id="passengers"
          name="passengers"
          type="number"
          min={1}
          value={passengers}
          onChange={(e) => setPassengers(e.target.value)}
        />
      </Field>
      <Field label="Capacidad / categoría" htmlFor="capacity" className="sm:col-span-2">
        {recurring ? (
          <NativeSelect
            id="capacity"
            name="capacity"
            className="w-full"
            value={effectiveCapacity}
            onChange={(e) => {
              setCapacity(e.target.value);
              setPriceTouched(false);
            }}
          >
            <NativeSelectOption value="">—</NativeSelectOption>
            {capacities.map((c) => (
              <NativeSelectOption key={c} value={c}>
                {c} plazas
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        )}
      </Field>
      <Field
        label="Precio"
        htmlFor="price"
        className="sm:col-span-2"
        hint={rate ? `Tarifa: ${formatMoney(rate.price)}` : undefined}
      >
        <Input
          id="price"
          name="price"
          inputMode="decimal"
          value={effectivePrice}
          onChange={(e) => {
            setPrice(e.target.value);
            setPriceTouched(true);
          }}
          placeholder={recurring ? "Según tarifa" : "0"}
          className="tabular-nums"
        />
      </Field>

      <Field
        label="Chofer"
        htmlFor="driverId"
        className="sm:col-span-2"
        hint={historicDriver ? `Histórico: ${historicDriver}` : undefined}
      >
        <NativeSelect id="driverId" name="driverId" className="w-full" defaultValue={defaults.driverId ?? ""}>
          <NativeSelectOption value="">—</NativeSelectOption>
          {drivers
            .filter((d) => d.active || d.id === defaults.driverId)
            .map((d) => (
              <NativeSelectOption key={d.id} value={d.id}>
                {d.name}
                {d.active ? "" : " (inactivo)"}
              </NativeSelectOption>
            ))}
        </NativeSelect>
        {historicDriver && <input type="hidden" name="driver" value={historicDriver} />}
      </Field>
      {/* Solo un dato asociado: no modifica capacidad, tarifa ni precio. */}
      <Field label="Vehículo" htmlFor="vehicleId" className="sm:col-span-2">
        <NativeSelect id="vehicleId" name="vehicleId" className="w-full" defaultValue={defaults.vehicleId ?? ""}>
          <NativeSelectOption value="">—</NativeSelectOption>
          {vehicles
            .filter((v) => v.active || v.id === defaults.vehicleId)
            .map((v) => (
              <NativeSelectOption key={v.id} value={v.id}>
                {v.plate} · {v.model} ({v.seats}){v.active ? "" : " (inactivo)"}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </Field>
      <Field label="Pago al chofer" htmlFor="driverPay" className="sm:col-span-2">
        <Input id="driverPay" name="driverPay" inputMode="decimal" defaultValue={defaults.driverPay ?? ""} />
      </Field>
      <Field label="Estación de servicio" htmlFor="fuelSupplier" className="sm:col-span-2">
        <Input
          id="fuelSupplier"
          name="fuelSupplier"
          list="fuel-suppliers"
          defaultValue={defaults.fuelSupplier ?? DEFAULT_FUEL_SUPPLIER}
        />
        <datalist id="fuel-suppliers">
          {FUEL_SUPPLIERS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
      <Field label="Gasoil ($)" htmlFor="fuelPesos" className="sm:col-span-2">
        <Input id="fuelPesos" name="fuelPesos" inputMode="decimal" defaultValue={defaults.fuelPesos ?? ""} />
      </Field>
      <Field label="Gasoil (litros)" htmlFor="fuelLiters" className="sm:col-span-2">
        <Input id="fuelLiters" name="fuelLiters" inputMode="decimal" defaultValue={defaults.fuelLiters ?? ""} />
      </Field>
      <Field label="Pagos adicionales" htmlFor="extraPayments" className="sm:col-span-3">
        <Input id="extraPayments" name="extraPayments" inputMode="decimal" defaultValue={defaults.extraPayments ?? ""} />
      </Field>
      <Field label="Observaciones" htmlFor="notes" className="sm:col-span-6">
        <Textarea id="notes" name="notes" rows={2} defaultValue={defaults.notes ?? ""} />
      </Field>
    </div>
  );
}
