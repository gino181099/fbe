// Lógica pura del resumen mensual (sin base de datos): se testea con Vitest.

export type MonthTotal = { month: string; total: number };
export type MonthlyRow = {
  month: string;
  billed: number | null;
  collected: number | null;
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

/** "2026-09" → "sep 2026". */
export function formatMonth(month: string) {
  return `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** Arma una fila por mes rellenando con 0; una serie `null` (sin permiso) queda en `null`. Margen = facturado − gastos. */
export function buildMonthlySeries(
  months: string[],
  series: Record<"billed" | "collected" | "expenses", MonthTotal[] | null>,
): MonthlyRow[] {
  const lookup = (rows: MonthTotal[] | null) => {
    if (!rows) return null;
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.month, (map.get(r.month) ?? 0) + r.total);
    return map;
  };
  const billed = lookup(series.billed);
  const collected = lookup(series.collected);
  const expenses = lookup(series.expenses);
  return months.map((month) => {
    const b = billed ? (billed.get(month) ?? 0) : null;
    const c = collected ? (collected.get(month) ?? 0) : null;
    const e = expenses ? (expenses.get(month) ?? 0) : null;
    return { month, billed: b, collected: c, expenses: e, margin: b != null && e != null ? b - e : null };
  });
}

/** Totales del período por serie (`null` si la serie no es visible). */
export function totalsOf(rows: MonthlyRow[]) {
  const sum = (key: keyof Omit<MonthlyRow, "month">) =>
    rows.length && rows[0][key] != null ? rows.reduce((s, r) => s + (r[key] ?? 0), 0) : null;
  return { billed: sum("billed"), collected: sum("collected"), expenses: sum("expenses"), margin: sum("margin") };
}
