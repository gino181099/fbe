const arsWhole = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const arsCents = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/** Pesos: sin decimales si el monto es entero, con dos si tiene centavos ($ 150.000,50). */
export const formatMoney = (n: number | null | undefined) =>
  n == null ? "—" : Number.isInteger(Math.round(n * 100) / 100) ? arsWhole.format(n) : arsCents.format(n);
export const formatNumber = (n: number | null | undefined) => (n == null ? "—" : decimal.format(n));

/** "2025-10-12" → "12/10/2025" (sin pasar por Date para evitar corrimientos de zona horaria). */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const arDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

/** Día (en Argentina) de un instante, como "YYYY-MM-DD". */
export const dayInAR = (d: Date) => arDay.format(d);

const arDateTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Instante → "25/10/2026, 14:30" (hora de Argentina). */
export const formatDateTime = (d: Date | null | undefined) => (d ? arDateTime.format(d) : "—");

/** Fecha de hoy en Argentina como "YYYY-MM-DD". */
export function today() {
  return dayInAR(new Date());
}

/** Resta días a una fecha ISO. */
export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function firstDayOfMonth(iso = today()) {
  return `${iso.slice(0, 7)}-01`;
}
