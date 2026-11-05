// Ids de la URL (`/contactos/[id]`, PDFs): solo enteros positivos que entran en un `integer` de Postgres.
// Uno fuera de rango (ej. 99999999999) hacía fallar la consulta en vez de dar "no encontrado".
const PG_INT_MAX = 2_147_483_647;

export function parseId(value: string | undefined | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return id >= 1 && id <= PG_INT_MAX ? id : null;
}
