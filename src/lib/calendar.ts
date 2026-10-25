import { addDays } from "./format";

export const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** "2026-10" válido o null. */
export function parseMonth(v: string | undefined) {
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null;
}

/** "2026-10" → "Octubre 2026". */
export const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** Mes anterior / siguiente ("2026-12" + 1 → "2027-01"). */
export function shiftMonth(month: string, delta: number) {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Día de la semana con lunes = 0 (sin zona horaria: la fecha se toma a mediodía UTC). */
const weekdayMon0 = (iso: string) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;

/**
 * Semanas (lunes a domingo) que cubren el mes, como fechas "YYYY-MM-DD".
 * Incluye los días del mes anterior/siguiente que completan la primera y la última semana.
 */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const start = addDays(first, -weekdayMon0(first));
  const next = `${shiftMonth(month, 1)}-01`;
  const weeks: string[][] = [];
  for (let day = start; day < next || weeks.length === 0; ) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(day, i));
    weeks.push(week);
    day = addDays(day, 7);
  }
  return weeks;
}
