// Utilidades del saldo histórico (script db:saldar-historico). El estado de cuenta vive en ledger.ts.

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
