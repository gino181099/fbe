// Número de comprobante (puro, seguro para cliente).

/**
 * "X 0001-00000001": letra, punto de venta (4 dígitos) y número (8 dígitos). Muestra lo que haya:
 * sin punto de venta solo el número; sin número, solo la letra (o "").
 */
export function formatDocNumber(
  letter: string | null | undefined,
  pos: number | null | undefined,
  number: number | null | undefined,
) {
  const num =
    number == null
      ? null
      : pos == null
        ? String(number).padStart(8, "0")
        : `${String(pos).padStart(4, "0")}-${String(number).padStart(8, "0")}`;
  return [letter, num].filter(Boolean).join(" ");
}
