/**
 * Interpreta montos escritos a la argentina o con punto decimal:
 * "1.500.000,50" → 1500000.5 · "50.000" → 50000 · "1500.5" → 1500.5 · "$ 200000" → 200000
 * Devuelve null si el texto está vacío o no es un número.
 */
export function parseAmount(input: string): number | null {
  const s = input.replace(/\s|\$/g, "");
  if (s === "") return null;
  let normalized: string;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, "");
  else normalized = s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
