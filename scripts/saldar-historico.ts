// Salda la deuda histórica (importada sin cobros) con ajustes mensuales: para cada
// cliente y mes hasta --hasta, registra al último día del mes un movimiento `kind='ajuste'`
// igual a facturado − cobrado − ajustes manuales, dejando el mes en saldo 0.
// Es idempotente (índice único cliente + source + period) y por defecto solo SIMULA.
//
// Uso: npm run db:saldar-historico -- --hasta 2026-08 [--cliente <id>]... [--todos-legacy] [--aplicar]
//   Sin --cliente ni --todos-legacy: solo Viajes Conocer.
import { and, eq, ilike, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "../src/db";
import { clients, collections, trips } from "../src/db/schema";
import { type MonthTotals, lastDayOfMonth, planHistoricAdjustments } from "../src/lib/statement";

const SOURCE = "saldo-historico";

/* ─────────────────────────────── Argumentos ─────────────────────────────── */

const args = process.argv.slice(2);
let hasta: string | undefined;
const clientIds: number[] = [];
let todosLegacy = false;
let aplicar = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--hasta") hasta = args[++i];
  else if (a === "--cliente") clientIds.push(Number(args[++i]));
  else if (a === "--todos-legacy") todosLegacy = true;
  else if (a === "--aplicar") aplicar = true;
  else fail(`Argumento desconocido: ${a}`);
}
if (!hasta || !/^\d{4}-(0[1-9]|1[0-2])$/.test(hasta)) fail("Falta --hasta YYYY-MM (ej. --hasta 2026-08)");
if (clientIds.some((id) => !Number.isInteger(id) || id <= 0)) fail("--cliente debe ser un id numérico");
const cutoff = lastDayOfMonth(hasta);

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mmYYYY = (period: string) => `${period.slice(5, 7)}/${period.slice(0, 4)}`;

/* ─────────────────────────────── Alcance ─────────────────────────────── */

async function targetClients() {
  if (clientIds.length) {
    const rows = await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds));
    const missing = clientIds.filter((id) => !rows.some((r) => r.id === id));
    if (missing.length) fail(`No existen los clientes: ${missing.join(", ")}`);
    return rows;
  }
  if (todosLegacy) {
    return db
      .selectDistinct({ id: clients.id, name: clients.name })
      .from(clients)
      .innerJoin(trips, eq(trips.clientId, clients.id))
      .where(isNotNull(trips.legacySource))
      .orderBy(clients.name);
  }
  const rows = await db.select({ id: clients.id, name: clients.name }).from(clients).where(ilike(clients.name, "%conocer%"));
  if (rows.length !== 1) fail(`Se esperaba 1 cliente "Conocer" y hay ${rows.length}: usá --cliente <id>`);
  return rows;
}

/* ─────────────────────────────── Cálculo ─────────────────────────────── */

const month = (col: typeof trips.date | typeof collections.date) => sql<string>`to_char(${col}, 'YYYY-MM')`;

async function monthsFor(clientId: number) {
  const [billed, moves] = await Promise.all([
    db
      .select({ period: month(trips.date), v: sql<number>`coalesce(sum(${trips.price}), 0)`.mapWith(Number) })
      .from(trips)
      .where(and(eq(trips.clientId, clientId), lte(trips.date, cutoff)))
      .groupBy(month(trips.date)),
    db
      .select({
        period: month(collections.date),
        collected: sql<number>`coalesce(sum(${collections.amount}) filter (where ${collections.kind} = 'cobro' and ${collections.source} is null), 0)`.mapWith(Number),
        manual: sql<number>`coalesce(sum(${collections.amount}) filter (where ${collections.kind} = 'ajuste' and ${collections.source} is null), 0)`.mapWith(Number),
      })
      .from(collections)
      .where(and(eq(collections.clientId, clientId), lte(collections.date, cutoff)))
      .groupBy(month(collections.date)),
  ]);
  // Ajustes del script por su `period` (no por fecha), incluso si alguien les cambió la fecha.
  const script = await db
    .select({ period: collections.period, amount: collections.amount })
    .from(collections)
    .where(and(eq(collections.clientId, clientId), eq(collections.source, SOURCE), isNotNull(collections.period)));

  const months = new Map<string, MonthTotals>();
  const get = (p: string) => {
    let m = months.get(p);
    if (!m) months.set(p, (m = { billed: 0, collected: 0, manualAdjusted: 0, scriptAdjusted: 0 }));
    return m;
  };
  for (const b of billed) get(b.period).billed = b.v;
  for (const c of moves) {
    get(c.period).collected = c.collected;
    get(c.period).manualAdjusted = c.manual;
  }
  for (const s of script) if (s.period && s.period <= hasta!) get(s.period).scriptAdjusted = s.amount;
  return months;
}

/* ─────────────────────────────── Ejecución ─────────────────────────────── */

type Write = { kind: "upsert"; clientId: number; period: string; amount: number } | { kind: "delete"; clientId: number; period: string };

async function main() {
  const targets = await targetClients();
  console.log(`${aplicar ? "APLICANDO" : "SIMULACIÓN (no escribe nada; agregá --aplicar)"} · hasta ${cutoff} · ${targets.length} cliente(s)\n`);

  const writes: Write[] = [];
  const counts = { insertar: 0, actualizar: 0, borrar: 0 };
  let grandTotal = 0;

  for (const c of targets) {
    const plan = planHistoricAdjustments(await monthsFor(c.id));
    const relevant = plan.filter((p) => p.billed || p.collected || p.manualAdjusted || p.scriptAdjusted);
    if (!relevant.length) continue;
    console.log(`── ${c.name} (id ${c.id})`);
    console.table(
      relevant.map((p) => ({
        mes: mmYYYY(p.period),
        facturado: fmt(p.billed),
        cobrado: fmt(p.collected),
        "ajuste manual": fmt(p.manualAdjusted),
        "ajuste existente": fmt(p.scriptAdjusted),
        "ajuste a registrar": fmt(p.target),
        acción: p.action,
      })),
    );
    const over = relevant.filter((p) => p.billed - p.collected - p.manualAdjusted < -0.005);
    for (const p of over)
      console.log(`   ⚠ ${mmYYYY(p.period)}: cobrado ${fmt(p.collected + p.manualAdjusted)} > facturado ${fmt(p.billed)} (no se toca)`);
    const total = relevant.reduce((s, p) => s + p.target, 0);
    grandTotal += total;
    console.log(`   Total ajuste ${c.name}: $ ${fmt(total)}\n`);

    for (const p of relevant) {
      if (p.action === "insertar" || p.action === "actualizar") {
        counts[p.action]++;
        writes.push({ kind: "upsert", clientId: c.id, period: p.period, amount: p.target });
      } else if (p.action === "borrar") {
        counts.borrar++;
        writes.push({ kind: "delete", clientId: c.id, period: p.period });
      }
    }
  }

  console.log(`TOTAL AJUSTES: $ ${fmt(grandTotal)}`);
  console.log(`${counts.insertar} a insertar, ${counts.actualizar} a actualizar, ${counts.borrar} a borrar`);
  if (!writes.length) return console.log("0 cambios");
  if (!aplicar) return console.log("Simulación: no se escribió nada.");

  await db.transaction(async (tx) => {
    for (const w of writes) {
      await (w.kind === "delete"
      ? tx
          .delete(collections)
          .where(and(eq(collections.clientId, w.clientId), eq(collections.source, SOURCE), eq(collections.period, w.period)))
      : tx
          .insert(collections)
          .values({
            clientId: w.clientId,
            date: lastDayOfMonth(w.period),
            amount: w.amount,
            kind: "ajuste",
            method: null,
            notes: `Saldo histórico ${mmYYYY(w.period)}`,
            source: SOURCE,
            period: w.period,
          })
          .onConflictDoUpdate({
            target: [collections.clientId, collections.source, collections.period],
            set: { kind: "ajuste", amount: w.amount, date: lastDayOfMonth(w.period), notes: `Saldo histórico ${mmYYYY(w.period)}` },
          }));
    }
  });
  console.log(`Listo: ${writes.length} cambio(s) aplicados.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
