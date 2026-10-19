# T-022 · Gastos nuevos (general o por vehículo, con comprobante)

- Estado: Implementada
- Prioridad: Media
- Riesgo: Alto <!-- cambia un enum con datos de producción + montos en reportes y Flota -->
- Fecha: 2026-10-19
- Tarea: `specs/TAREAS.md` → T-022

## Contexto
Hoy un gasto tiene categoría combustible/sueldo/varios, concepto y proveedor de texto libre y vehículo opcional. Se quiere saber de qué es cada gasto (general o de un vehículo, categoría y subcategoría), qué se hizo y para qué, con qué comprobante y si se pagó en el momento o queda a pagar al proveedor (cuenta corriente de T-021). Sin adjuntos. Depende de T-021 (`supplier`, `expense.supplier_id`, `expense.paid`).

## Objetivo
Cargar y filtrar gastos con el modelo nuevo; los gastos "a pagar" suman a la cuenta del proveedor; Flota suma los gastos de cada vehículo en su costo; Inicio no cambia sus números históricos.

## Criterios de aceptación
- [x] CA1 Enum `expense_category` = `vehiculo | personal | generales | combustible`; tras migrar no quedan `sueldo`/`varios`: `sueldo→personal`, `varios` con vehículo→`vehiculo`, `varios` sin vehículo→`generales`. La cantidad y suma de gastos no cambian.
- [x] CA2 `expense` tiene `scope` (`general|vehiculo`, default `general`), `subcategory`, `purpose`, `voucher_type` (`factura_a|factura_b|factura_c|recibo|ticket|sin_comprobante`, default `sin_comprobante`), `voucher_number`; backfill `scope='vehiculo'` donde hay `vehicle_id`. Check en la base: `scope='vehiculo'` ⇔ `vehicle_id` no nulo.
- [x] CA3 Formulario "Registrar gasto": fecha, alcance (General / Vehículo), vehículo, categoría, subcategoría (sugerencias), proveedor (select de activos + "—"), qué se hizo, para qué, comprobante (tipo + número), contado / a pagar, monto, chofer (opcional), observaciones. Sin adjuntos.
- [x] CA4 Validaciones con mensajes en español: alcance Vehículo sin vehículo → "Elegí el vehículo"; alcance General ignora el vehículo; "A pagar" sin proveedor → "Para dejarlo a pagar elegí un proveedor"; categoría Combustible exige proveedor y queda siempre contado (es pago a estación del gasoil ya contado).
- [x] CA5 Un gasto "a pagar" aparece como debe en `/finanzas/proveedores/[id]` y sube el saldo; pasado a contado deja de sumar.
- [x] CA6 Listado de `/finanzas/gastos`: columnas Fecha · Categoría/subcategoría · Qué / para qué · Proveedor · Comprobante · Vehículo · Estado (Contado / A pagar) · Monto; filtros nuevos por alcance, proveedor y estado, además de los actuales; StatCards Total + 4 categorías + "A pagar".
- [x] CA7 Flota: la columna Gastos de cada vehículo suma los gastos con `scope='vehiculo'` de ese vehículo en el período (sin categoría combustible, que ya está en la columna Gasoil) + adicionales de recorridos; el monto enlaza a `/finanzas/gastos?vehiculo=<id>&desde&hasta`.
- [x] CA8 Inicio (T-016) muestra los mismos números que antes: gastos generales siguen siendo `expense` sin combustible (contado y a pagar, por fecha del gasto) + `fuel_load`; `supplier_payment` no suma.
- [x] CA9 La pestaña Combustible y los gastos con chofer siguen funcionando igual; `scripts/migrate-legacy.ts` compila (usa `generales`).

## Diseño
### Datos
- Constantes nuevas en `src/lib/constants.ts`: `EXPENSE_CATEGORIES` (se mueve desde `schema.ts` y se re-exporta allí, como `COLLECTION_KINDS`), `EXPENSE_CATEGORY_LABELS`, `EXPENSE_SUBCATEGORIES` por categoría (vehículo: Mantenimiento, Repuestos, Cubiertas, Seguro, Patente, VTV, Lavado, Peajes, Cuota; personal: Sueldos, Viáticos, Cargas sociales; generales: Alquiler, Servicios, Teléfono, Contador, Impuestos, Bancarios, Publicidad; combustible: Pago a estación), `EXPENSE_SCOPES` + labels, `VOUCHER_TYPES` + labels (Factura A/B/C, Recibo, Ticket, Sin comprobante). Reemplaza `VEHICLE_EXPENSE_CONCEPTS`.
- Migración (número: siguiente libre **después** de la de T-021; nombre `gastos_nuevos`). Cambio de enum **sin** `ALTER TYPE … ADD VALUE` (evita la trampa de MEMORIA): `ALTER COLUMN category TYPE text` → `UPDATE` de mapeo → `DROP TYPE expense_category` → `CREATE TYPE` con los 4 valores → `ALTER COLUMN category TYPE expense_category USING category::expense_category`. drizzle-kit genera algo parecido al quitar valores: revisar el SQL e insertar el `UPDATE` entre medio. Luego `CREATE TYPE expense_scope`/`expense_voucher_type`, columnas nuevas, backfill de `scope` y el `CHECK`. Todo en una migración/transacción.
- `expense.concept` = "Qué se hizo"; `purpose` = "Para qué". `expense.supplier` (texto) deja de escribirse; se muestra solo si no hay `supplier_id`.
### Permisos
Sin cambios: `finanzas` view/edit (Flota sigue con `ventas` y montos con `finanzas` view).
### UI
Textos: "Alcance" (General / Vehículo), "Qué se hizo", "Para qué", "Comprobante", "N° de comprobante", "Pago" (Contado / A pagar), hint del proveedor "¿No está? Crealo en Proveedores".

## Mapa de código
- `src/db/schema.ts` › l.330–356 (`EXPENSE_CATEGORIES`, `expenseCategory`, `expenses`) — re-export desde constants, enums nuevos, columnas, `check()` de drizzle.
- `src/lib/constants.ts` — agregar al final (archivo compartido con T-018..T-021); quitar `VEHICLE_EXPENSE_CONCEPTS` (l.59) solo si no queda en uso.
- `src/app/(app)/finanzas/actions.ts` › `expenseSchema`/`saveExpense` (l.52–80) — campos nuevos, `superRefine` para CA4, `vehicleId=null` si general, `paid=true` si combustible.
- `src/app/(app)/finanzas/fields.tsx` › `EXPENSE_LABELS` (l.21, pasar a `EXPENSE_CATEGORY_LABELS`) y `ExpenseFields` (l.88–156) — recibir `suppliers` en props; datalist de subcategorías; `SupplierField` (l.8) queda solo para `FuelLoadFields`.
- `src/app/(app)/finanzas/gastos/page.tsx` — filtros (l.30–49), query de filas con `leftJoin(suppliers)` (l.52–58), `byCategory`/StatCards (l.59–63, 91, 191–196), tabla (l.200–258), cargar lista de proveedores para el form. `fuelPayments` (l.74–78) ya ajustado por T-021: no romperlo.
- `src/app/(app)/flota/page.tsx` › `vehicleExpenses` (l.55–59) — filtrar `eq(expenses.scope,"vehiculo")` y `ne(expenses.category,"combustible")`; celda Gastos (l.152, 173) con `Link`.
- `src/lib/reports.ts` (l.49–55) — no cambia (ya excluye combustible); solo confirmar que compila con el enum nuevo.
- `scripts/migrate-legacy.ts` (l.208) — `"varios"` → `"generales"`.
- Patrón de enum en constants + re-export: `COLLECTION_KINDS` (`constants.ts` l.8, `schema.ts` l.250–252).

## Plan
- [x] 1. Antes de migrar, anotar: conteo y suma de `expense` por categoría, gastos con vehículo, y totales de Inicio/Flota de un período con datos (2025).
- [x] 2. Constants + schema; `db:generate -- --name gastos_nuevos`; ajustar SQL (mapeo + backfill + check); `db:migrate`; comparar conteos/sumas.
- [x] 3. Acción y formulario; `migrate-legacy.ts`.
- [x] 4. Listado/filtros de Gastos; Flota.

## Verificación
- `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build`
- Manual: comparar números del paso 1. Crear proveedor "ZZ Prueba" y gastos de prueba: general contado, vehículo sin vehículo (error), vehículo con vehículo (ver en Flota), a pagar sin proveedor (error), a pagar con "ZZ Prueba" (ver saldo en su cuenta). Borrar todo lo de prueba.

## Fuera de alcance
- Adjuntos/fotos de comprobantes. Pagos parciales por gasto (se paga contra la cuenta del proveedor, T-021). Borrar la columna `expense.supplier`. Desglose de gastos por categoría en Flota. Proveedor en el form de recorrido/carga extra.

## Decisiones propuestas
- D1 Gasto "a pagar" en reportes — **Por defecto:** cuenta como gasto en su fecha (devengado), igual que contado · Alternativa: contar recién al pagarlo.
  - ✅ Usuario: por defecto.
- D2 Combustible con vehículo en Flota — **Por defecto:** excluido (ya está en Gasoil) · Alternativa: sumarlo en Gastos.
  - ✅ Usuario: por defecto.
- D3 Formulario — **Por defecto:** server-rendered, vehículo siempre visible y validado en la acción · Alternativa: componente cliente que oculta vehículo y filtra subcategorías según alcance/categoría.
  - ✅ Usuario: por defecto.
- D4 Proveedor obligatorio — **Por defecto:** opcional en contado, obligatorio en a pagar y combustible · Alternativa: siempre obligatorio.
  - ✅ Usuario: por defecto.

## Preguntas bloqueantes
- Ninguna

---

## Notas de implementación
- Antes/después de `0010_gastos_nuevos` (Neon): 90 gastos / $72.387.945,38 → iguales. combustible 19 / $24.763.131,37 (sin cambio); varios 71 / $47.624.814,01 → generales 71 / mismo monto (no había `sueldo` ni gastos con vehículo, así que `vehiculo` y backfill de `scope` quedaron en 0 filas). Serie mensual de Inicio (expense sin combustible, 2025-01…2025-11) idéntica; pagos de combustible por proveedor iguales.
- Migración: drizzle generó `SET DATA TYPE text → DROP TYPE → CREATE TYPE → USING`; se insertó el `UPDATE` de mapeo entre medio y el backfill de `scope` antes del `CHECK expense_scope_vehicle_check` ((scope='vehiculo') = (vehicle_id is not null)). Una sola migración.
- Reglas CA4 extraídas a `src/lib/expense-rules.ts` (`resolveExpense`, pura) con test (`expense-rules.test.ts`); `saveExpense` solo parsea con zod y la usa. Mensajes exactos (sin el prefijo de `firstError`). Combustible sin proveedor: "Para combustible elegí la estación (proveedor)". Con "Sin comprobante" se descarta el número.
- Se quitó el puente de T-021 (`supplierIdByName`); `expense.supplier` (texto) ya no se escribe ni se pisa al editar; en el listado se muestra solo si no hay `supplier_id`. Proveedor enlaza a `/finanzas/proveedores/[id]`.
- StatCards (Total, 4 categorías, A pagar) usan solo el período, como antes; los filtros nuevos (alcance, proveedor, estado) aplican a la tabla. Observaciones pasan debajo de "Qué / para qué" (la columna no está en la lista de CA6).
- Hallazgo menor T-021 resuelto: la pestaña Combustible agrupa estaciones por `lower(trim(nombre))` (mismo criterio que la cuenta del proveedor), mostrando el primer nombre visto.
- Flota: `scope='vehiculo'` y sin combustible (antes sumaba cualquier gasto con vehículo; no había filas, sin cambio de números); monto con `Link` a Gastos con período. Nota del margen actualizada.
- `SupplierField` queda solo para cargas de combustible (label "Estación"). `VEHICLE_EXPENSE_CONCEPTS` eliminado (reemplazado por `EXPENSE_SUBCATEGORIES`); `EXPENSE_LABELS` reemplazado por `EXPENSE_CATEGORY_LABELS`.
- Prueba contra la base (script temporal, datos "PRUEBA ZZ T-022" borrados, 0 restos): general contado ignora vehículo; vehículo sin vehículo → error; vehículo con vehículo suma en query de Flota; a pagar sin proveedor → error; a pagar con proveedor → saldo 7000 y línea `gasto` en estado de cuenta; pasado a contado → saldo 0; `CHECK` rechaza scope vehiculo sin vehículo (23514). Sin clics en navegador.
- Archivos: `src/lib/constants.ts`, `src/lib/expense-rules(.test).ts`, `src/lib/supplier-ledger.test.ts` (categoría `generales`), `src/db/schema.ts`, `drizzle/0010_gastos_nuevos.sql` (+ meta), `src/app/(app)/finanzas/{actions.ts,fields.tsx,gastos/page.tsx}`, `src/app/(app)/flota/page.tsx`, `scripts/migrate-legacy.ts`.

## Revisión
Veredicto: APROBADO
Criterios: CA1 ✅ · CA2 ✅ · CA3 ✅ · CA4 ✅ · CA5 ✅ · CA6 ✅ · CA7 ✅ · CA8 ✅ · CA9 ✅ (revisado por código/SQL; sin prueba en navegador)
Hallazgos:
1. [MENOR] src/app/(app)/flota/page.tsx:~183 — el enlace a `/finanzas/gastos?vehiculo=<id>` lista también gastos de combustible con ese vehículo, que la columna Gastos excluye → el total de la lista puede no coincidir con el monto → (hoy 0 filas) agregar `categoria` o aclarar si aparece el caso.
2. [MENOR] migración 0010 — `UPDATE` y `DROP TYPE` dependen de que no haya otras columnas/usos del enum `expense_category`; ya aplicada y verificada (90 gastos, misma suma), sin acción.
Verificado: no quedan usos de `VEHICLE_EXPENSE_CONCEPTS`, `EXPENSE_LABELS` ni `supplierIdByName`; migrate-legacy usa `generales`; SQL mapea sueldo/varios correctamente y el CHECK va después del backfill; reglas CA4 en `expense-rules.ts` correctas; Combustible agrupa por lower(trim).
