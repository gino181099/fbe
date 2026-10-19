# T-019 · Recibos numerados con PDF

- Estado: Aprobada
- Prioridad: Alta
- Riesgo: Alto (esquema + migración, saldos y "Cobrado" de Inicio/reportes)
- Fecha: 2026-10-19
- Tarea: `specs/TAREAS.md` → T-019 · Base: `specs/T-017-cc-comprobantes-modelo.md`, `specs/T-018-cc-pantallas-comprobantes.md` · Plan: `C:\Users\ginof\.claude\plans\vamos-a-hacer-algunos-buzzing-diffie.md`

## Contexto
Desde el corte (19/10/2026) los pagos de clientes se documentan con recibos numerados (X 0001-00000001) en lugar de `collection`. Por T-017 D2, `collection` ≥ corte sigue contando como crédito hasta esta tarea; acá Cobros pasa a historial de solo lectura.

## Objetivo
El usuario registra un recibo por monto libre o tildando recorridos pendientes (el monto se calcula solo), descarga su PDF con el monto en letras, y el saldo, "Cobrado" de Inicio y los reportes lo reflejan sin cambiar los números históricos.

## Criterios de aceptación
- [ ] CA1 Migración `0008_recibos` crea `receipt` y `receipt_trip`; aplica con `db:migrate` sin tocar filas existentes.
- [ ] CA2 Numeración: `number` = máximo + 1 (incluye anulados, nunca se reutiliza), arranca en 1, único; ante 23505 se reintenta una vez. Se muestra `X 0001-00000001` con `formatDocNumber` (T-018), letra/pv fijos `RECEIPT_LETTER`/`RECEIPT_POS` en constants.
- [ ] CA3 `/finanzas/recibos/nuevo?cliente=`: muestra saldo del cliente y los recorridos ≥ corte con `remaining > 0` (fecha, detalle, precio, pendiente); tildar suma los pendientes en vivo; el monto es editable y debe ser ≥ Σ tildados (el excedente va FIFO); fecha ≥ `CC_START`, medio de pago (sugerencias `PAYMENT_METHODS`), observaciones.
- [ ] CA4 Validaciones en la acción: monto > 0; recorridos del cliente; cada asignación ≤ pendiente actual del recorrido (recalculado con el ledger en el servidor); Σ asignaciones ≤ monto.
- [ ] CA5 Ledger: recibos vigentes = crédito `kind: "recibo"` ("Recibo X 0001-00000001 (Transferencia)"); `receipt_trip` = `allocations` aplicadas antes del FIFO (hook de T-017). Tests: recibo con viajes tildados cancela esos viajes aunque haya débitos más viejos; excedente FIFO; recibo anulado no cuenta.
- [ ] CA6 Anular recibo (motivo opcional) setea `voided_at`/`voided_reason`; deja de contar y libera sus viajes. Sin editar ni borrar.
- [ ] CA7 `GET /api/recibo/[id]` (finanzas view; 403/404) devuelve PDF: encabezado común de `pdf-brand.tsx` (T-018), "Recibo X N° 0001-00000001", fecha, "Recibimos de <cliente> (CUIT, dirección) la suma de pesos <en letras> ($ <número>)", concepto (lista de viajes tildados con importe y/o "a cuenta del saldo"), medio de pago, observaciones, línea de firma, "Documento no válido como factura"; si está anulado, "ANULADO".
- [ ] CA8 `src/lib/amount-words.ts` con tests: 0, 1 ("un"), 21 ("veintiún"), 100 ("cien"), 101, 1.000 ("mil"), 1.000.000 ("un millón"), 2.500.000, 1.234.567,89, centavos 0 y 5 ("05/100"), negativos rechazados.
- [ ] CA9 `/finanzas/recibos`: listado (fecha, número, cliente, medio, monto, estado) con filtros cliente/desde/hasta/estado y total; acciones PDF y Anular. Sidebar: "Recibos" reemplaza a "Cobros"; Cobros queda como "Cobros (historial)".
- [ ] CA10 `/finanzas/cobros` solo lectura (sin alta/edición/borrado; descripción "Historial de cobros anterior a la cuenta corriente"); se eliminan `saveCollection`/`deleteCollection` y `CollectionFields`. En `/finanzas/cuentas/[id]` "Registrar cobro" pasa a "Registrar recibo" (link a `/finanzas/recibos/nuevo?cliente=<id>`).
- [ ] CA11 "Cobrado" = `collection` kind cobro + recibos vigentes, por fecha: en `getMonthlyTotals` (`reports.ts`), "Cobrado del mes" de Inicio y `getBalances().collected` (recibos + collection cobro ≥ corte). La serie mensual de Inicio para meses previos al corte da igual que antes.
- [ ] CA12 Borrar un cliente con recibos o un recorrido en un recibo devuelve error legible; `updateTrip` también bloquea cambiar precio/cliente/fecha de un recorrido con `receipt_trip` vigente.

## Diseño
### Datos
- `receipt`: `id` identity, `number int not null` (`uniqueIndex`), `date date not null`, `client_id` → client (restrict), `amount money not null`, `method text`, `notes text`, `voided_at timestamp`, `voided_reason text`, `created_at`. `index(client_id, date)`.
- `receipt_trip`: `id`, `receipt_id` → receipt (cascade), `trip_id` → trip (restrict), `amount money not null`. `index(receipt_id)`, `index(trip_id)`. La unicidad "un viaje cancelado una vez" no se fuerza: un viaje puede tener asignaciones parciales de varios recibos; el tope lo da `remaining`.
- `npm run db:generate -- --name recibos` → revisar que sea solo CREATE (sin DROP) → `db:migrate`. Sin backfill.
- Alta: insert `receipt` `.returning({ id })` y luego `receipt_trip`; si falla, borrar el recibo (cascade).
- `collection` ≥ corte (si las hubiera, cargadas entre T-017 y esta tarea) sigue contando como crédito (ver D1).
### Permisos
`finanzas` view: listados y PDF; `finanzas` edit: alta y anulación.
### UI
Tras guardar: toast "Recibo X 0001-00000001 registrado" y redirección a `/finanzas/recibos?nuevo=<id>`, que muestra un aviso con botón "Descargar PDF".

## Mapa de código
- `src/db/schema.ts` sección Finanzas (después de `documentItems` ~315): `receipts`, `receiptTrips` (helper `money` ~18; patrón de `documents` ~282).
- `src/lib/constants.ts`: `RECEIPT_LETTER = "X"`, `RECEIPT_POS = 1`; agregar `recibo` a `MOVEMENT_KINDS`/`MOVEMENT_KIND_LABELS`; mover `PAYMENT_METHODS` desde `src/app/(app)/finanzas/fields.tsx` (~22).
- `src/lib/amount-words.ts` + `amount-words.test.ts` nuevos (puros). Formato: "Pesos ciento veinte mil quinientos con 50/100".
- `src/lib/ledger.ts` (T-017): agregar crédito tipo recibo y alimentar `allocations` desde `receipt_trip`; tests en `ledger.test.ts`.
- `src/lib/balances.ts` › `getBalances` (~16): sumar recibos vigentes a `collected` y al saldo; › `getStatement` (~43): traer recibos vigentes ≤ `to` + sus `receipt_trip`. `totalCollected` incluye recibos.
- `src/lib/receipts.ts` nuevo (`server-only`): `listReceipts`, `getReceipt(id)` (con viajes + cliente), `nextReceiptNumber()`, `getPendingTrips(clientId)` (vía ledger: débitos tipo recorrido con `remaining > 0`).
- `src/app/(app)/finanzas/recibos/actions.ts` (`createReceipt(input)` objeto tipado como `saveRateVersion` en `src/app/(app)/contactos/actions.ts` ~183; `voidReceipt`), `page.tsx`, `nuevo/page.tsx`, `receipt-form.tsx` ("use client"). Imitar `src/app/(app)/finanzas/comprobantes/` de T-018 (form con checkboxes y total en vivo). Reutilizar `isUniqueViolation` compartido (T-018).
- `src/lib/receipt-pdf.tsx` + `src/app/api/recibo/[id]/route.tsx`: imitar `src/lib/document-pdf.tsx`/`src/app/api/comprobante/[id]/route.tsx` (T-018), con `pdf-brand.tsx` y `company.ts`. Archivo `recibo-X-0001-00000001.pdf`.
- `src/app/(app)/finanzas/cobros/page.tsx`: quitar FormDialog/ConfirmButton/`canEdit` (~64-77, ~144-161) y el import de acciones. `src/app/(app)/finanzas/actions.ts` (~18-48) quitar cobros; `fields.tsx` (~24-81) quitar `CollectionFields`.
- `src/app/(app)/finanzas/cuentas/[id]/page.tsx` (~55-66): botón "Registrar recibo".
- `src/lib/reports.ts` › `getMonthlyTotals` (~30-48): sumar consulta de `receipt` (no anulados, mismo mes/cliente) al `collected` por mes. `src/app/(app)/page.tsx` (~46-51): "Cobrado del mes" = collection cobro + recibos. Revisar `src/lib/monthly.ts` si combina series.
- `src/app/(app)/contactos/actions.ts` borrar cliente (~110): contar `receipts`. `src/app/(app)/ventas/actions.ts` › `deleteTrip`: mensaje "está en un comprobante o recibo"; `updateTrip`: extender el chequeo de T-018 a `receipt_trip` de recibos vigentes.
- `src/components/app-sidebar.tsx` (~45): "Recibos" `/finanzas/recibos` + "Cobros (historial)". No tocar los ítems que agreguen T-021/T-022.
- `specs/MEMORIA.md`: regla "collection post-corte cuenta hasta T-019" → recibos; "Cobrado" = recibos + collection histórica.

## Plan
- [ ] 1. Constantes + esquema; `db:generate -- --name recibos`; revisar SQL; `db:migrate`.
- [ ] 2. `amount-words.ts` + tests; ledger con recibos + tests.
- [ ] 3. `receipts.ts`, acciones, páginas, sidebar.
- [ ] 4. PDF del recibo.
- [ ] 5. Cobros a solo lectura; botón en cuenta corriente.
- [ ] 6. `balances.ts`, `reports.ts`, Inicio; borrados/edición de recorridos; MEMORIA.

## Verificación
- `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build` (una vez, al final)
- Antes de migrar, anotar la tabla mensual de Inicio (rango por defecto) y "Cobrado del mes"; después debe coincidir (sin recibos).
- Manual (cliente "Prueba T-019", borrar todo al final): 3 recorridos ≥ corte; recibo tildando el 3.º (lo cancela aunque los otros sean más viejos); recibo por monto libre (FIFO al 1.º y parcial al 2.º); ver estado de cuenta, `/finanzas`, Inicio; descargar PDF y revisar letras; anular un recibo (vuelve el saldo, el número no se reutiliza); intentar borrar un recorrido con recibo (error legible). Borrar recibos, recorridos y cliente.

## Fuera de alcance
- Semáforo y vencidos (T-020); imputar recibos a saldo inicial/ND por ítem (van por FIFO).
- Migrar `collection` a recibos; editar recibos; envío por mail/WhatsApp.

## Decisiones propuestas
- D1 `collection` con fecha ≥ corte ya cargadas — **Por defecto:** siguen contando como crédito y se ven en Cobros (historial); no se migran · Alternativa: convertirlas en recibos numerados en la migración.
  - ✅ Usuario: por defecto.
- D2 Monto al tildar viajes — **Por defecto:** el pendiente de cada viaje (precio − lo ya cubierto) · Alternativa: el precio completo del viaje.
  - ✅ Usuario: por defecto.
- D3 Monto mayor a lo tildado — **Por defecto:** se permite, el excedente se aplica FIFO (o queda a favor) · Alternativa: con viajes tildados el monto queda fijo en Σ tildados.
  - ✅ Usuario: por defecto.
- D4 PDF — **Por defecto:** una copia por hoja · Alternativa: original y duplicado en la misma hoja A4.
  - ✅ Usuario: por defecto.
- D5 Texto en letras — **Por defecto:** "Pesos … con NN/100" (minúsculas, primera mayúscula) · Alternativa: todo en mayúsculas.
  - ✅ Usuario: por defecto.

## Preguntas bloqueantes
- Ninguna

---

## Notas de implementación
_(completa el implementador: desvíos del plan, decisiones, archivos tocados)_

## Revisión
_(completa el revisor)_
