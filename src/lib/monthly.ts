// Lógica pura del resumen mensual (sin base de datos): se testea con Vitest.

export type MonthTotal = { month: string; total: number };
export type MonthlyRow = {
  month: string;
  billed: number | null;
  collected: number | null;
  directCosts: number | null;
  generalExpenses: number | null;
  expenses: number | null;
  margin: number | null;
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Los últimos `n` meses ("YYYY-MM") que terminan en el mes de `endIso`, del más viejo al más nuevo. */
export function lastMonths(endIso: string, n = 12): string[] {
  const year = Number(endIso.slice(0, 4));
  const month = Number(endIso.slice(5, 7)) - 1; // 0-11
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const idx = year * 12 + month - i;
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

/** Meses ("YYYY-MM") entre dos fechas o meses (inclusive), del más viejo al más nuevo. Vacío si `from > to`. */
export function monthsBetween(from: string, to: string): string[] {
  const idx = (s: string) => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7)) - 1;
  const out: string[] = [];
  for (let i = idx(from); i <= idx(to); i++) {
    out.push(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`);
  }
  return out;
}

/** Tope de meses del rango de Inicio. */
export const MAX_MONTHS = 36;

/** `YYYY-MM-DD` válido (existe como día del calendario). */
function validDate(v?: string | null) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : undefined;
}

/**
 * Rango efectivo de Inicio: fechas inválidas se ignoran; sin `hasta` = hoy; sin `desde` = 1ro del mes
 * 11 meses antes de `hasta`; si `desde > hasta` se intercambian; más de 36 meses recorta `desde`.
 */
export function resolveRange(desde: string | undefined, hasta: string | undefined, todayIso: string) {
  let to = validDate(hasta) ?? todayIso;
  let from = validDate(desde) ?? `${lastMonths(to, 12)[0]}-01`;
  if (from > to) [from, to] = [to, from];
  if (monthsBetween(from, to).length > MAX_MONTHS) from = `${lastMonths(to, MAX_MONTHS)[0]}-01`;
  return { from, to, months: monthsBetween(from, to) };
}

/** "2026-09" → "sep 2026". */
export function formatMonth(month: string) {
  return `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

type SeriesKey = "billed" | "collected" | "directCosts" | "generalExpenses";

/**
 * Arma una fila por mes rellenando con 0; una serie `null` (sin permiso o no aplica) queda en `null`.
 * Gastos = costos directos + gastos generales (los visibles); Margen = facturado − gastos.
 */
export function buildMonthlySeries(months: string[], series: Record<SeriesKey, MonthTotal[] | null>): MonthlyRow[] {
  const lookup = (rows: MonthTotal[] | null) => {
    if (!rows) return null;
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.month, (map.get(r.month) ?? 0) + r.total);
    return map;
  };
  const billed = lookup(series.billed);
  const collected = lookup(series.collected);
  const direct = lookup(series.directCosts);
  const general = lookup(series.generalExpenses);
  return months.map((month) => {
    const b = billed ? (billed.get(month) ?? 0) : null;
    const c = collected ? (collected.get(month) ?? 0) : null;
    const d = direct ? (direct.get(month) ?? 0) : null;
    const g = general ? (general.get(month) ?? 0) : null;
    const e = d == null && g == null ? null : (d ?? 0) + (g ?? 0);
    return {
      month,
      billed: b,
      collected: c,
      directCosts: d,
      generalExpenses: g,
      expenses: e,
      margin: b != null && e != null ? b - e : null,
    };
  });
}

/** Totales del período por serie (`null` si la serie no es visible). */
export function totalsOf(rows: MonthlyRow[]) {
  const sum = (key: keyof Omit<MonthlyRow, "month">) =>
    rows.length && rows[0][key] != null ? rows.reduce((s, r) => s + (r[key] ?? 0), 0) : null;
  return {
    billed: sum("billed"),
    collected: sum("collected"),
    directCosts: sum("directCosts"),
    generalExpenses: sum("generalExpenses"),
    expenses: sum("expenses"),
    margin: sum("margin"),
  };
}
