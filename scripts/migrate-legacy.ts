// Importa la base SQLite anterior (frabel-database) a Neon Postgres.
// Es idempotente: se puede correr varias veces sin duplicar datos, y no pisa
// registros ya importados (si los editaste en el ERP, se respetan).
//
// Uso: npm run db:import-legacy [-- ruta/al/archivo]
import { copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { db } from "../src/db";
import { clients, DEFAULT_FUEL_SUPPLIER, expenses, fuelLoads, rates, routes, trips } from "../src/db/schema";

const source = process.argv[2] ?? "frabel-database";
if (!existsSync(source)) {
  console.error(`No se encontró el archivo ${source}`);
  process.exit(1);
}
// Se trabaja sobre una copia para no generar archivos -wal/-shm junto al original.
const copy = join(tmpdir(), `frabel-legacy-${Date.now()}.sqlite`);
copyFileSync(source, copy);
const legacy = new DatabaseSync(copy, { readOnly: true });

type Row = Record<string, unknown>;
const all = (sql: string) => legacy.prepare(sql).all() as Row[];

/** Limpia espacios y caracteres rotos por mala codificación (Monta�a → Montaña). */
function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/�/g, "ñ").replace(/\s+/g, " ").trim();
  return s === "" || /^-+$/.test(s) ? null : s;
}
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
function day(value: unknown): string {
  const s = clean(value);
  const m = s?.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) throw new Error(`Fecha inválida: ${value}`);
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}
function chunks<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const warnings: string[] = [];

// Nombre completo en el ERP de agencias y clientes que en la base vieja figuran abreviados/mal escritos.
const AGENCY_NAMES: Record<string, string> = { Conocer: "Viajes Conocer", Impulsar: "Impulsa Mendoza" };
const agencyName = (raw: unknown) => {
  const name = clean(raw)!;
  return AGENCY_NAMES[name] ?? name;
};
// Cliente de un Servicio_Especial: sin nombre ("-"/null) → "Particular".
const specialClientName = (raw: unknown) => {
  const name = clean(raw);
  return name ? (AGENCY_NAMES[name] ?? name) : "Particular";
};

async function main() {
  const agencyRows = all("SELECT * FROM Servicio_Agencia");
  const specialRows = all("SELECT * FROM Servicio_Especial");
  const tariffRows = all("SELECT * FROM Tarifario");

  // ── Clientes ──
  const recurring = new Set(agencyRows.map((r) => agencyName(r.Agencia)));
  tariffRows.forEach((r) => recurring.add(agencyName(r.Agencia)));
  const special = new Set(specialRows.map((r) => specialClientName(r.Cliente)));
  recurring.forEach((n) => special.delete(n));

  await db
    .insert(clients)
    .values([
      ...[...recurring].map((name) => ({ name, type: "recurrente" as const })),
      ...[...special].map((name) => ({ name, type: "especial" as const })),
    ])
    .onConflictDoNothing({ target: clients.name });
  const clientId = new Map((await db.select().from(clients)).map((c) => [c.name, c.id]));

  // ── Recorridos (catálogo) ──
  const routeNames = new Set<string>();
  tariffRows.forEach((r) => routeNames.add(clean(r.Recorrido)!));
  agencyRows.forEach((r) => routeNames.add(clean(r.Recorrido)!));
  await db
    .insert(routes)
    .values([...routeNames].map((name) => ({ name })))
    .onConflictDoNothing({ target: routes.name });
  const routeId = new Map((await db.select().from(routes)).map((r) => [r.name, r.id]));

  // ── Tarifario ──
  const existingRates = await db.select().from(rates);
  const rateKey = (c: number, r: number, cap: number, from: string) => `${c}|${r}|${cap}|${from}`;
  const known = new Set(existingRates.map((r) => rateKey(r.clientId, r.routeId, r.capacity, r.validFrom)));
  const newRates = tariffRows
    .map((r) => ({
      clientId: clientId.get(agencyName(r.Agencia))!,
      routeId: routeId.get(clean(r.Recorrido)!)!,
      capacity: Number(r.Capacidad),
      price: num(r.Precio) ?? 0,
      validFrom: day(r.fecha_inicio),
      validTo: r.fecha_fin ? day(r.fecha_fin) : null,
    }))
    .filter((r) => !known.has(rateKey(r.clientId, r.routeId, r.capacity, r.validFrom)));
  if (newRates.length) await db.insert(rates).values(newRates);
  const allRates = await db.select().from(rates);

  // ── Recorridos de agencias ──
  // En la base vieja "Capacidad" son los pasajeros; la categoría tarifaria
  // (8/14/18) está al final de id_tarifa ("Conocer-Alta Montaña-14").
  const agencyTrips = agencyRows.map((r) => {
    const client = agencyName(r.Agencia);
    const route = clean(r.Recorrido)!;
    const date = day(r.Fecha);
    const idTarifa = clean(r.id_tarifa) ?? "";
    const m = idTarifa.match(/^(.*)-(.*)-(\d+)$/);
    const capacity = m ? Number(m[3]) : null;
    if (m && clean(m[2]) !== route) {
      warnings.push(
        `SRId ${r.SRId}: id_tarifa "${idTarifa}" no coincide con el recorrido ${route}; se usa ${route} / ${capacity}`,
      );
    }
    const cId = clientId.get(client)!;
    const rId = routeId.get(route)!;
    const rate = allRates.find(
      (t) =>
        t.clientId === cId &&
        t.routeId === rId &&
        t.capacity === capacity &&
        t.validFrom <= date &&
        (!t.validTo || date <= t.validTo),
    );
    if (!rate)
      warnings.push(`SRId ${r.SRId} (${date}, ${client}, ${route}, cat. ${capacity}): sin tarifa vigente, precio en 0`);
    return {
      date,
      clientId: cId,
      routeId: rId,
      passengers: num(r.Capacidad),
      capacity,
      rateId: rate?.id ?? null,
      price: rate?.price ?? 0,
      driver: clean(r.Chofer),
      driverPay: num(r.Pago_Chofer),
      fuelPesos: num(r.Consumo_Gasoil_Pesos),
      fuelLiters: num(r.Consumo_Gasoil_Litros),
      fuelSupplier: num(r.Consumo_Gasoil_Pesos) ? DEFAULT_FUEL_SUPPLIER : null,
      extraPayments: num(r.Pagos_Adicionales),
      notes: clean(r.Observaciones),
      legacySource: "Servicio_Agencia",
      legacyId: Number(r.SRId),
    };
  });

  // ── Servicios especiales ──
  const specialTrips = specialRows.map((r) => {
    const route = clean(r.Recorrido);
    return {
      date: day(r.Fecha),
      clientId: clientId.get(specialClientName(r.Cliente))!,
      routeId: route ? (routeId.get(route) ?? null) : null,
      routeText: route && !routeId.has(route) ? route : null,
      passengers: null,
      capacity: null,
      rateId: null,
      price: num(r.Ingreso) ?? 0,
      driver: clean(r.Chofer),
      driverPay: num(r.Pago_Chofer),
      fuelPesos: num(r.Consumo_Gasoil_Pesos),
      fuelLiters: num(r.Consumo_Gasoil_Litros),
      fuelSupplier: num(r.Consumo_Gasoil_Pesos) ? DEFAULT_FUEL_SUPPLIER : null,
      extraPayments: num(r.Pagos_Adicionales),
      notes: clean(r.Observaciones),
      legacySource: "Servicio_Especial",
      legacyId: Number(r.SCId),
    };
  });

  let tripsInserted = 0;
  for (const batch of chunks([...agencyTrips, ...specialTrips])) {
    const res = await db
      .insert(trips)
      .values(batch)
      .onConflictDoNothing({ target: [trips.legacySource, trips.legacyId] })
      .returning({ id: trips.id });
    tripsInserted += res.length;
  }

  // ── Gastos ──
  const expenseRows = [
    ...all("SELECT * FROM Pagos_Combustible").map((r) => ({
      date: day(r.Fecha),
      category: "combustible" as const,
      concept: "Pago a estación de servicio",
      supplier: DEFAULT_FUEL_SUPPLIER,
      amount: num(r.Monto_Abonado) ?? 0,
      notes: clean(r.Observaciones),
      legacySource: "Pagos_Combustible",
      legacyId: Number(r.PCId),
    })),
    // Los pagos "Shell" de Pagos_Varios son cargas de combustible en Shell Maza.
    ...all("SELECT * FROM Pagos_Varios").map((r) => {
      const shell = clean(r.Observaciones) === "Shell";
      return {
        date: day(r.Fecha),
        category: shell ? ("combustible" as const) : ("varios" as const),
        concept: shell ? "Carga de combustible" : clean(r.Observaciones),
        supplier: shell ? "Shell Maza" : null,
        amount: num(r.Monto_Abonado) ?? 0,
        notes: null,
        legacySource: "Pagos_Varios",
        legacyId: Number(r.PVId),
      };
    }),
  ];
  let expensesInserted = 0;
  for (const batch of chunks(expenseRows)) {
    const res = await db
      .insert(expenses)
      .values(batch)
      .onConflictDoNothing({ target: [expenses.legacySource, expenses.legacyId] })
      .returning({ id: expenses.id });
    expensesInserted += res.length;
  }

  // ── Cargas extras de combustible ──
  const loads = all("SELECT * FROM Cargas_Extras").map((r) => ({
    date: day(r.Fecha),
    pesos: num(r.Consumo_Gasoil_Pesos) ?? 0,
    liters: num(r.Consumo_Gasoil_Litros),
    supplier: DEFAULT_FUEL_SUPPLIER,
    notes: clean(r.Observaciones),
    legacyId: Number(r.CEId),
  }));
  const loadsRes = await db
    .insert(fuelLoads)
    .values(loads)
    .onConflictDoNothing({ target: fuelLoads.legacyId })
    .returning({ id: fuelLoads.id });

  for (const table of ["Cobros_Agencias", "Cobros_Varios", "Sueldos"]) {
    const n = all(`SELECT count(*) AS n FROM ${table}`)[0].n;
    if (Number(n) > 0) warnings.push(`${table} tiene ${n} filas que este script todavía no importa`);
  }

  console.log("\n── Importación terminada ──");
  console.log(`Clientes: ${recurring.size} recurrentes, ${special.size} especiales`);
  console.log(`Recorridos (catálogo): ${routeNames.size}`);
  console.log(`Tarifas nuevas: ${newRates.length} (de ${tariffRows.length})`);
  console.log(`Viajes nuevos: ${tripsInserted} (de ${agencyTrips.length} agencia + ${specialTrips.length} especiales)`);
  console.log(`Gastos nuevos: ${expensesInserted} (de ${expenseRows.length})`);
  console.log(`Cargas de combustible nuevas: ${loadsRes.length} (de ${loads.length})`);
  if (warnings.length) {
    console.log(`\n⚠ Revisar (${warnings.length}):`);
    warnings.forEach((w) => console.log(" - " + w));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => legacy.close());
