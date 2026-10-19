// Montos en letras para recibos (puro, seguro para cliente): "Pesos ciento veinte mil quinientos con 50/100".

const UNITS = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const TEENS = [
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
];
const TWENTIES = [
  "veinte",
  "veintiún",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
];
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const HUNDREDS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

/** 1–999 en letras (con apócope: "un", "veintiún", "treinta y un"). */
function belowThousand(n: number): string {
  if (n === 100) return "cien";
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let tail = "";
  if (rest >= 30) tail = TENS[Math.floor(rest / 10)] + (rest % 10 ? ` y ${UNITS[rest % 10]}` : "");
  else if (rest >= 20) tail = TWENTIES[rest - 20];
  else if (rest >= 10) tail = TEENS[rest - 10];
  else tail = UNITS[rest];
  return [HUNDREDS[h], tail].filter(Boolean).join(" ");
}

/** Entero ≥ 0 en letras, apocopado para montos ("un millón", "veintiún mil"). */
export function integerToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error("Se espera un entero no negativo");
  if (n === 0) return "cero";
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions) parts.push(millions === 1 ? "un millón" : `${integerToWords(millions)} millones`);
  if (thousands) parts.push(thousands === 1 ? "mil" : `${belowThousand(thousands)} mil`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

/** "Pesos un millón doscientos treinta y cuatro mil quinientos sesenta y siete con 89/100". */
export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("El monto debe ser un número no negativo");
  const cents = Math.round(amount * 100);
  const whole = Math.floor(cents / 100);
  return `Pesos ${integerToWords(whole)} con ${String(cents % 100).padStart(2, "0")}/100`;
}
