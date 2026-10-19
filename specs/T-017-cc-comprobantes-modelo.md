# T-017 · Cuenta corriente con comprobantes: modelo, corte y saldo inicial

- Estado: Implementada
- Prioridad: Alta
- Riesgo: Alto (esquema + migración, cálculo de saldos)
- Fecha: 2026-10-19
- Tarea: `specs/TAREAS.md` → T-017 · Plan general: `C:\Users\ginof\.claude\plans\vamos-a-hacer-algunos-buzzing-diffie.md`

## Contexto
Hoy saldo = Σ recorridos − Σ `collection` (todo el historial). El rediseño de Finanzas (T-017…T-022) pasa a una cuenta corriente con comprobantes tipificados que arranca el **19/10/2026**. Esta tarea pone el modelo, la lógica pura y adapta `balances.ts`; pantallas (T-018), recibos (T-019) y mora (T-020) vienen después.

## Objetivo
La base tiene `document`/`document_item` y `client.payment_days`; los saldos y el estado de cuenta (pantalla y PDF) se calculan con el nuevo modelo desde el corte, sin romper nada y sin cambiar los números históricos mensuales de Inicio.

## Criterios de aceptación
- [x] CA1 Migración `0007_cuenta_corriente` crea enum `document_type` (factura, interno, nota_debito, nota_credito, bonificacion, saldo_inicial), tablas `document` y `document_item`, y `client.payment_days int not null default 30`; aplica con `db:migrate` sin errores y sin tocar filas existentes.
- [x] CA2 `CC_START = "2026-10-19"` y `DOCUMENT_TYPES` + etiquetas en `src/lib/constants.ts` (el enum del esquema se arma desde ahí).
- [x] CA3 `src/lib/ledger.ts` (puro, sin `@/db`) arma movimientos ordenados con saldo corrido: débitos = recorridos ≥ corte, ND, saldo inicial; créditos = NC, bonificación, `collection` ≥ corte (cobro y ajuste). Factura/interno no generan movimiento de saldo.
- [x] CA4 Aplicación FIFO de créditos sobre débitos (primero asignaciones explícitas, después el resto a lo más viejo); cada débito informa `paid`, `remaining`, `status` (`pendiente|parcial|cancelado`) y `dueDate` (vencimiento del comprobante factura/interno que lo incluye; si no, fecha + `paymentDays`). Sobrante de créditos = saldo a favor.
- [x] CA5 `src/lib/ledger.test.ts` cubre: corte (pre-corte no suma), factura/interno no duplican deuda, ND/NC/bonificación, saldo inicial por ítems, FIFO parcial y total, asignación explícita antes del FIFO, saldo a favor, dueDate por comprobante y por `paymentDays`, orden en el mismo día.
- [x] CA6 `getBalances()` devuelve por cliente `{ billed, collected, adjusted, balance, trips }` con el nuevo modelo desde el corte (billed = débitos, collected = `collection` cobro ≥ corte, adjusted = ajustes ≥ corte + NC + bonificación). Mismas claves: `/finanzas`, `/contactos`, `/contactos/[id]` e Inicio compilan sin cambios de tipos.
- [x] CA7 `getStatement(clientId, from, to)` usa el ledger: si `from < CC_START` se toma `CC_START` (saldo anterior 0); devuelve la misma forma que hoy (`opening, lines, totalDebit, totalCredit, totalCollected, closing`, `from` efectivo). `/finanzas/cuentas/[id]` y `/api/estado-cuenta/[clientId]` funcionan; las líneas muestran etiqueta por tipo.
- [x] CA8 `src/lib/reports.ts` y las consultas mensuales de Inicio no se modifican: la serie mensual (facturado/cobrado/gastos) da igual que antes. Solo cambian "saldo a cobrar"/deudores (pasan a ser saldo desde el corte).
- [x] CA9 Borrar un recorrido incluido en un comprobante, o un cliente con comprobantes, devuelve un error legible (no excepción).
- [x] CA10 `specs/MEMORIA.md`: reemplazar la regla "Saldo del cliente = …" por las reglas nuevas (corte, factura/interno no suman, FIFO, collection post-corte cuenta hasta T-019).

## Diseño
### Datos
- `document`: `id` identity, `type document_type not null`, `letter text` (A/B/C/X, validado en acciones), `pos int`, `number int`, `date date not null`, `due_date date`, `client_id` → client (restrict), `amount money not null`, `related_document_id` → document (set null), `notes text`, `created_at`. Índices: `uniqueIndex(type, letter, pos, number)` (nulos distintos: saldo inicial/bonificación sin número no chocan), `index(client_id, date)`.
- `document_item`: `id`, `document_id` → document (cascade), `trip_id` → trip (restrict, nullable), `date date not null`, `description text not null`, `amount money not null`. ~~`uniqueIndex(trip_id)` parcial~~ → por D4: índice común `document_item_trip_idx`; la unicidad "un recorrido en un solo comprobante factura|interno vigente" se valida en la acción (helper `tripsInActiveDocuments`). `document` suma `voided_at` (timestamp) + `voided_reason` (anular = marcar). `index(document_id)`.
- `client.payment_days`. Sin backfill (default 30). Una sola migración: crear enum + tablas no es la trampa de `ADD VALUE`.
- `document.amount` = Σ ítems (lo garantizan las acciones de T-018); `getBalances` suma `document.amount`, el ledger usa ítems solo para FIFO del saldo inicial.
- Reglas del ledger: saldo inicial se incluye siempre (aunque su fecha sea < corte) y se ordena primero; en el estado de cuenta es **una** línea "Saldo inicial" en la fecha del documento (o `CC_START` si es anterior); para FIFO/vencimiento cuenta cada ítem con su fecha. Mismo día: saldo inicial → débitos → créditos. Comparaciones con redondeo a centavos.
- Hook T-019: la entrada de créditos acepta `allocations` (crédito → recorrido, monto) que se aplican antes del FIFO; los recibos se agregarán como otro tipo de crédito sin cambiar la firma. Hook T-020: `dueDate` por débito ya calculado; el semáforo queda para T-020.
### Permisos
Sin cambios (`finanzas` view para ver saldos/estado de cuenta).
### UI
Sin pantallas nuevas. `/finanzas`: PageHeader con descripción "Cuenta corriente desde el 19/10/2026". `/finanzas/cuentas/[id]`: `desde` por defecto = máx(1/1 del año, `CC_START`); badge por tipo con `MOVEMENT_KIND_LABELS`.

## Mapa de código
- `src/db/schema.ts` › `clients` (~109) agregar `paymentDays`; sección Finanzas (~245) agregar `documentType`, `documents`, `documentItems` (usar helper `money` ~18, patrón de `collections` ~251; índice parcial con `.where(sql\`…\`)`). Import de `DOCUMENT_TYPES` desde constants (~15).
- `src/lib/constants.ts` (~8) agregar `CC_START`, `DOCUMENT_TYPES`, `DocumentType`, `DOCUMENT_TYPE_LABELS`, `MOVEMENT_KIND_LABELS` (recorrido, saldo_inicial, nota_debito, nota_credito, bonificacion, cobro, ajuste). Mantener `COLLECTION_KIND_LABELS` (lo usa Cobros).
- `src/lib/ledger.ts` nuevo: tipos de entrada (trips, documents con items, collections, allocations, paymentDays, cutoff) y `buildLedger` → `{ lines, debits, credit sobrante, totales }`; `buildStatementFromLedger(from, to)` o equivalente que corta por período y calcula `opening`. Reutilizar la lógica de descripción de recorrido y saldo corrido de `buildStatement` en `src/lib/statement.ts` (~33-83).
- `src/lib/statement.ts`: quitar `buildStatement`/`StatementLine` (pasan a ledger; ver D6); **dejar** `lastDayOfMonth` y `planHistoricAdjustments` (los usa `db:saldar-historico`). Portar sus casos de `src/lib/statement.test.ts` (~30-115) a `ledger.test.ts`.
- `src/lib/balances.ts` › `getBalances` (~16): consultas agrupadas por cliente de trips `date ≥ CC_START` (suma), conteo de trips (D5), documents por tipo (`sum filter where type = …`), collections `date ≥ CC_START` por kind (`sumOfKind` ~10 con filtro de fecha). › `getStatement` (~43): traer trips ≥ corte ≤ `to`, documents (≠ factura/interno para saldo; factura/interno con items solo para `dueDate`), collections ≥ corte ≤ `to`, y pasar al ledger. Re-exportar el tipo de línea (lo importa `statement-pdf.tsx` ~2 vía `ReturnType`).
- `src/app/(app)/finanzas/cuentas/[id]/page.tsx` (~31 default `desde`; ~129 `COLLECTION_KIND_LABELS[l.kind]` → `MOVEMENT_KIND_LABELS`; ~51 descripción con `data.from`).
- `src/app/api/estado-cuenta/[clientId]/route.tsx` (~18) y `src/lib/statement-pdf.tsx` (~89): solo ajustar si cambia el tipo; usar `data.from` efectivo.
- `src/app/(app)/finanzas/page.tsx` (~50) descripción del header.
- `src/app/(app)/ventas/actions.ts` › `deleteTrip` (~115): capturar 23001/23503 como en `src/app/(app)/flota/actions.ts` (~19-20) → "No se puede eliminar: el recorrido está en un comprobante".
- `src/app/(app)/contactos/actions.ts` › borrar cliente (~110): sumar conteo de `documents` al chequeo y al mensaje.
- No tocar: `src/lib/reports.ts`, consultas de `src/app/(app)/page.tsx` (~39-80).

## Plan
- [x] 1. Constantes + esquema; `npm run db:generate -- --name cuenta_corriente`; revisar el SQL (índice parcial, sin DROP) y `npm run db:migrate`.
- [x] 2. `ledger.ts` + `ledger.test.ts` (portar casos de `statement.test.ts`); `npm test`.
- [x] 3. Adaptar `balances.ts` y quitar `buildStatement`.
- [x] 4. Ajustar estado de cuenta (página + PDF), header de `/finanzas`, borrados de recorrido/cliente.
- [x] 5. MEMORIA.md.

## Verificación
- `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build` (una vez, al final)
- Antes de migrar, anotar de Inicio (rango por defecto) la tabla mensual; después debe coincidir.
- Manual (datos de prueba, borrarlos al final): cliente de prueba; por SQL/Drizzle Studio un `saldo_inicial` con 2 ítems, un recorrido con fecha ≥ corte, una `factura` que lo incluya (saldo no se duplica), una NC; ver `/finanzas`, `/finanzas/cuentas/[id]` y el PDF. Intentar borrar el recorrido (error legible). Borrar todo.

## Fuera de alcance
- Pantallas/acciones de comprobantes y saldo inicial, edición de `payment_days` (T-018/T-020); restricciones al editar un recorrido incluido en un comprobante (T-018).
- `receipt`/`receipt_trip`, numeración y "Cobrado" con recibos (T-019). Semáforo y vencido en listados/PDF (T-020).
- Proveedores y gastos (T-021/T-022).

## Decisiones propuestas
- D1 Estado de cuenta con `desde` < corte — **Por defecto:** se lleva al corte (saldo anterior 0); el historial previo se ve en Ventas/Cobros · Alternativa: mostrar lo previo como líneas informativas sin saldo.
  - ✅ Usuario: por defecto.
- D2 `collection` con fecha ≥ corte — **Por defecto:** cuenta como crédito (cobro y ajuste) hasta T-019; "Registrar cobro" sigue funcionando · Alternativa: bloquear cobros nuevos desde ya.
  - ✅ Usuario: por defecto.
- D3 Saldo inicial — **Por defecto:** se permite más de uno por cliente (suman) · Alternativa: uno solo (índice único parcial por cliente).
  - ✅ Usuario: por defecto.
- D4 Un recorrido en un solo comprobante — **Por defecto:** índice único parcial en `document_item.trip_id`; anular = borrar el comprobante · Alternativa: columna `voided_at` y validación en la acción.
  - ✅ Usuario: **alternativa** — anular = marcar. `document.voided_at` (timestamp, null = vigente) + `voided_reason` opcional. Un comprobante anulado no cuenta en el ledger (ningún tipo) y libera sus recorridos. La unicidad "un recorrido en un solo comprobante factura|interno vigente" se valida en la acción/consulta (un índice parcial sobre `document_item` no puede ver `voided_at` del padre). La numeración no se reutiliza. Helper puro para filtrar vigentes, con test.
- D5 `trips` en `getBalances` — **Por defecto:** conteo histórico total (dato de Contactos) · Alternativa: solo recorridos desde el corte.
  - ✅ Usuario: por defecto.
- D6 `buildStatement` — **Por defecto:** se elimina y sus tests pasan a `ledger.test.ts` · Alternativa: conservarlo sin uso.
  - ✅ Usuario: por defecto.
- D7 Factura/interno en el estado de cuenta — **Por defecto:** no aparecen en T-017 (se suman como líneas informativas en T-018) · Alternativa: líneas informativas ya, sin importe.
  - ✅ Usuario: por defecto.

## Preguntas bloqueantes
- Ninguna

---

## Notas de implementación
- **D4 alternativa aplicada**: `document.voided_at` + `voided_reason`; sin índice único parcial sobre `document_item.trip_id` (queda índice común para buscar). El ledger y `getBalances` ignoran anulados (ningún tipo); helpers puros `isActiveDocument`/`activeDocuments`/`tripsInActiveDocuments(docs, excluirId)` con test, para que T-018 valide la unicidad.
- Migración `drizzle/0007_cuenta_corriente.sql`: solo CREATE TYPE/TABLE/INDEX + ADD COLUMN `payment_days` default 30 (sin DROP ni backfill). Aplicada en Neon.
- `src/lib/ledger.ts` (nuevo): `buildLedger` (líneas con saldo corrido desde 0, débitos con `paid/remaining/status/dueDate`, `unappliedCredit` = saldo a favor; si los créditos netos fueran negativos queda negativo) y `statementFromLedger(ledger, from, to)`. FIFO: asignaciones explícitas (crédito `{source: collection|document, id}` → recorrido) y luego el total restante a lo más viejo (equivalente a aplicar crédito por crédito). ND/NC/bonificación anteriores al corte no cuentan (solo el saldo inicial se incluye siempre), igual en `getBalances`.
- `statement.ts`: quedan solo `lastDayOfMonth`/`planHistoricAdjustments`; tests de `buildStatement` portados a `ledger.test.ts` (24 casos).
- `balances.ts`: `getBalances` con 3 consultas agrupadas (trips con `sum filter date ≥ corte` + conteo total; documents vigentes por tipo; collections ≥ corte); `getStatement` arma el ledger (trips/collections ≥ corte ≤ to, documentos vigentes ≤ to con ítems) y devuelve `from` efectivo. `StatementLine` = `LedgerLine`.
- UI: `/finanzas/cuentas/[id]` desde por defecto = máx(1/1, corte), `min` en el input, badge `MOVEMENT_KIND_LABELS`, tarjeta "Cargos del período" (incluye ND/saldo inicial) y "Ajustes y notas de crédito"; mismo texto en el PDF. Header de `/finanzas` con la descripción del corte.
- Borrados: `deleteTrip` traduce 23001/23503 a "No se puede eliminar: el recorrido está en un comprobante"; `deleteClient` cuenta comprobantes.
- Verificación: Inicio (serie mensual facturado/cobrado/gastos por SQL) idéntica antes y después de migrar. Prueba con cliente "PRUEBA T-017" (saldo inicial 2 ítems, recorrido, factura que lo incluye, NC, NC anulada): saldo 2300 (sin duplicar por la factura, sin la anulada), estado de cuenta desde el corte, borrar el recorrido → 23001. Datos borrados (0 filas en document/document_item/PRUEBA). No se probó en el navegador.
- Archivos: `src/db/schema.ts`, `drizzle/0007_cuenta_corriente.sql` (+ meta), `src/lib/constants.ts`, `src/lib/ledger.ts`, `src/lib/ledger.test.ts`, `src/lib/statement.ts`, `src/lib/statement.test.ts`, `src/lib/balances.ts`, `src/lib/statement-pdf.tsx`, `src/app/(app)/finanzas/page.tsx`, `src/app/(app)/finanzas/cuentas/[id]/page.tsx`, `src/app/(app)/ventas/actions.ts`, `src/app/(app)/contactos/actions.ts`, `specs/MEMORIA.md`.

## Revisión
Veredicto: APROBADO
Criterios: CA1 ✅ · CA2 ✅ · CA3 ✅ · CA4 ✅ · CA5 ✅ · CA6 ✅ · CA7 ✅ · CA8 ✅ (reports.ts y consultas de Inicio sin tocar) · CA9 ✅ · CA10 ✅ (según notas). D4 alternativa (voided_at, sin índice único parcial, helpers de vigentes) correctamente aplicada; migración solo CREATE/ADD COLUMN, sin DROP.
Hallazgos:
1. [MENOR] src/db/schema.ts:330 — `EXPENSE_CATEGORIES =[` quedó con formato roto (sin espacio) → sin impacto funcional → restaurar espacio.
2. [MENOR] src/lib/ledger.ts:357 — la asignación explícita busca el débito por `tripId`; un recorrido con ítem de saldo inicial o ND no aplica, correcto por diseño, pero un crédito asignado a un recorrido pre-corte se ignora en silencio → documentar en T-019.
3. [MENOR] src/lib/balances.ts `getBalances` vs `buildLedger` mantienen la regla "saldo inicial siempre, ND/NC pre-corte no" duplicada en SQL y en JS → riesgo de divergencia futura; cubrir con test/nota en MEMORIA al agregar tipos.
