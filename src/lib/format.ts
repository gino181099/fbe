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

/** Fecha de hoy en Argentina como "YYYY-MM-DD". */
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
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
