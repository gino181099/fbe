import type { CollectionKind } from "./constants";

export type StatementLine = {
  date: string;
  kind: "recorrido" | CollectionKind;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export type StatementTripRow = {
  date: string;
  route: string | null;
  routeText: string | null;
  passengers: number | null;
  capacity: number | null;
  price: number;
};

export type StatementCollectionRow = {
  date: string;
  kind: CollectionKind;
  method: string | null;
  notes: string | null;
  amount: number;
};

/**
 * Arma las líneas del estado de cuenta (sin tocar la base): ordena por fecha
 * (recorridos antes que cobros/ajustes en el mismo día) y calcula el saldo corrido desde `opening`.
 */
export function buildStatement(
  opening: number,
  tripRows: StatementTripRow[],
  collectionRows: StatementCollectionRow[],
) {
  const moves = [
    ...tripRows.map((t) => ({
      date: t.date,
      kind: "recorrido" as const,
      description: [
        t.route ?? t.routeText ?? "Recorrido",
        t.capacity ? `(${t.capacity} plazas)` : null,
        t.passengers ? `· ${t.passengers} pax` : null,
      ]
        .filter(Boolean)
        .join(" "),
      debit: t.price,
      credit: 0,
    })),
    ...collectionRows.map((c) => ({
      date: c.date,
      kind: c.kind,
      description: (c.kind === "ajuste"
        ? ["Ajuste", c.notes ? `– ${c.notes}` : null]
        : ["Cobro", c.method ? `(${c.method})` : null, c.notes ? `– ${c.notes}` : null]
      )
        .filter(Boolean)
        .join(" "),
      debit: 0,
      credit: c.amount,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || rank(a.kind) - rank(b.kind));

  let running = opening;
  const lines: StatementLine[] = moves.map((m) => {
    running += m.debit - m.credit;
    return { ...m, balance: running };
  });

  return {
    opening,
    lines,
    totalDebit: lines.reduce((s, l) => s + l.debit, 0),
    totalCredit: lines.reduce((s, l) => s + l.credit, 0),
    // Solo plata recibida (sin ajustes): "Cobrado en el período".
    totalCollected: lines.reduce((s, l) => s + (l.kind === "cobro" ? l.credit : 0), 0),
    closing: running,
  };
}

const rank = (kind: StatementLine["kind"]) => (kind === "recorrido" ? 0 : 1);

/** Último día del mes "YYYY-MM" como "YYYY-MM-DD" (sin zonas horarias). */
export function lastDayOfMonth(period: string) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${period}-${String(d).padStart(2, "0")}`;
}

export type MonthTotals = { billed: number; collected: number; manualAdjusted: number; scriptAdjusted: number };
export type HistoricAdjustmentPlan = MonthTotals & {
  period: string;
  target: number;
  action: "insertar" | "actualizar" | "borrar" | "sin cambios";
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Plan de ajustes de saldo histórico por mes: ajuste objetivo = facturado − cobrado − ajustes manuales
 * (redondeado a 2 decimales). Si es ≤ 0 no corresponde ajuste (se borra el del script si existía).
 */
export function planHistoricAdjustments(months: Map<string, MonthTotals>): HistoricAdjustmentPlan[] {
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, t]) => {
      const raw = round2(t.billed - t.collected - t.manualAdjusted);
      const target = raw > 0 ? raw : 0;
      const existing = round2(t.scriptAdjusted);
      let action: HistoricAdjustmentPlan["action"] = "sin cambios";
      if (target > 0 && t.scriptAdjusted === 0) action = "insertar";
      else if (target > 0 && existing !== target) action = "actualizar";
      else if (target === 0 && t.scriptAdjusted !== 0) action = "borrar";
      return { period, ...t, target, action };
    });
}
