# T-013 · Saldo inicial y ajustes en cuentas corrientes

- Estado: Implementada <!-- Borrador → Aprobada → Implementada -->
- Prioridad: Media
- Fecha: 2026-09-28
- Tarea: `specs/TAREAS.md` → T-013

## Contexto
La base SQLite vieja no tenía cobros: al importarla, cada cliente figura debiendo todo lo facturado (Viajes Conocer ~$181M). El usuario sabe que esa deuda se pagó, pero no tiene el detalle. Hay que saldar la deuda histórica mes a mes sin inventar "cobros" que inflen los reportes de lo cobrado.

## Objetivo
Un script único e idempotente que, para los clientes y meses elegidos, registre al **último día de cada mes** un movimiento de tipo **ajuste** igual a lo facturado en ese mes menos lo ya cobrado/ajustado ese mes, dejando cada mes en saldo 0. Los ajustes se distinguen de los cobros en toda la app.

## Criterios de aceptación
- [ ] CA1 La tabla `collection` tiene columna `kind` (`cobro` | `ajuste`, default `cobro`); todas las filas existentes quedan como `cobro`.
- [ ] CA2 `npm run db:saldar-historico -- --hasta 2026-08` (sin `--aplicar`) **no escribe nada** y lista por cliente y mes: facturado, cobrado, ajuste existente y ajuste a registrar, más el total por cliente.
- [ ] CA3 Con `--aplicar`, para cada cliente/mes con diferencia > 0 inserta (o actualiza) un ajuste con fecha = último día del mes (ej. `2025-02-28`, `2024-02-29`), `method = null` y `notes = "Saldo histórico MM/AAAA"`.
- [ ] CA4 Correrlo dos veces con los mismos parámetros no duplica ajustes (la 2.ª corrida informa "0 cambios").
- [ ] CA5 Por defecto aplica solo a Viajes Conocer; `--cliente <id>` (repetible) o `--todos-legacy` cambia el alcance (ver Preguntas).
- [ ] CA6 Después de aplicar, en `/finanzas/cuentas/<id Conocer>` con rango hasta el mes de corte, el saldo al cierre de cada mes ≤ corte es $0 (salvo cobros reales mayores a lo facturado, que se informan y no se tocan).
- [ ] CA7 "Cobrado del mes" (Inicio), la columna/StatCard "Cobrado" de Cuentas corrientes y "Cobrado en el período" del estado de cuenta **excluyen** ajustes; el saldo sí los descuenta. Cuentas corrientes muestra una columna "Ajustes".
- [ ] CA8 El estado de cuenta (pantalla y PDF) muestra los ajustes como líneas "Ajuste – Saldo histórico MM/AAAA" en la columna Haber.
- [ ] CA9 En `/finanzas/cobros` cada fila muestra el tipo (badge "Ajuste" cuando corresponde) y hay filtro por tipo; el formulario de cobro permite elegir Tipo (Cobro / Ajuste) para ajustes manuales.
- [ ] CA10 `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan.

## Diseño
### Datos
- `src/db/schema.ts`: `COLLECTION_KINDS = ["cobro", "ajuste"] as const`, `collectionKind = pgEnum("collection_kind", COLLECTION_KINDS)`; en `collections`: `kind: collectionKind("kind").notNull().default("cobro")`, `source: text("source")` (null en cargas manuales; `"saldo-historico"` en las del script), `period: text("period")` (`"YYYY-MM"`, solo script).
- Índice único parcial para idempotencia: `uniqueIndex("collection_source_idx").on(t.clientId, t.source, t.period)` (con `source` null no choca, porque en Postgres los NULL son distintos).
- Migración: `npm run db:generate -- --name collection_kind` → `db:migrate`. Sin backfill manual: el `default 'cobro'` cubre las filas existentes.
- Label del tipo para el cliente en `src/lib/constants.ts` (`COLLECTION_KIND_LABELS`), sin importar valores de `@/db/schema` desde componentes cliente.

### Permisos
Sin cambios: ver/editar cobros sigue siendo `finanzas`. El script corre con las credenciales de `.env.local` (solo el equipo).

### Archivos
- `src/db/schema.ts` — enum + columnas + índice (arriba).
- `drizzle/XXXX_collection_kind.sql` — generada.
- `scripts/saldar-historico.ts` — nuevo (ver Plan). No importar `src/lib/balances.ts` (tiene `server-only`); usar `db` y `sql` directo.
- `package.json` — script `"db:saldar-historico": "tsx --env-file=.env.local scripts/saldar-historico.ts"`.
- `src/lib/balances.ts` — `getBalances` devuelve `{ billed, collected, adjusted, balance, trips }` (collected = solo `cobro`; balance = billed − collected − adjusted). `getStatement`: `StatementLine.kind` suma `"ajuste"`; descripción "Ajuste – {notes}"; `totalCredit` sigue incluyendo todo pero agregar `totalCollected` (solo cobros) para el StatCard.
- `src/app/(app)/page.tsx` — "Cobrado del mes" filtra `kind = 'cobro'`.
- `src/app/(app)/finanzas/page.tsx` — columna "Ajustes" y totales.
- `src/app/(app)/finanzas/cuentas/[id]/page.tsx` — StatCard usa `totalCollected`; las líneas `ajuste` se muestran con el mismo control que `cobro` (editar/borrar) o sin controles si es más simple, pero visibles.
- `src/lib/statement-pdf.tsx` — revisar que las líneas `ajuste` se rendericen (hoy solo cuenta `recorrido`).
- `src/app/(app)/finanzas/cobros/page.tsx` — columna/badge Tipo + filtro `?tipo=cobro|ajuste`.
- `src/app/(app)/finanzas/fields.tsx` y `actions.ts` — campo `kind` (NativeSelect, default "cobro") validado con `z.enum(COLLECTION_KINDS)`; mensajes "Ajuste registrado/actualizado" cuando corresponda. `saveCollection` **no** toca `source`/`period`.

### UI
- Estado de cuenta: línea "Ajuste – Saldo histórico 03/2025" en Haber.
- Cobros: badge gris "Ajuste"; filtro "Tipo: Todos / Cobros / Ajustes".
- Cuentas corrientes: columnas Facturado · Cobrado · Ajustes · Saldo.

## Plan
- [x] 1. Schema: enum `collection_kind`, columnas `kind`, `source`, `period`, índice único. Generar y aplicar migración; verificar en `db:studio` que los cobros existentes quedaron `cobro`.
- [x] 2. `scripts/saldar-historico.ts`: parsear args (`--hasta YYYY-MM` obligatorio; `--cliente <id>` repetible; `--todos-legacy`; `--aplicar`). Sin `--cliente` ni `--todos-legacy` → buscar Viajes Conocer por nombre (`ilike '%conocer%'`, abortar si hay 0 o >1).
- [x] 3. Consulta por cliente: recorridos agrupados por `to_char(date,'YYYY-MM')` con `date <= último día de --hasta`; cobros (`kind='cobro'`) y ajustes manuales (`kind='ajuste'` y `source` null) agrupados igual; ajuste existente del script (`source='saldo-historico'`).
- [x] 4. Ajuste objetivo del mes = facturado − cobrado − ajustes manuales, redondeado a 2 decimales. Si ≤ 0 → no registrar (y si había ajuste del script, informarlo y borrarlo solo con `--aplicar`). Si > 0 → upsert (`onConflictDoUpdate` sobre `(clientId, source, period)`, actualizando `amount`, `date`, `notes`).
- [x] 5. Último día del mes calculado como string `YYYY-MM-DD` (sin `Date` con zona; ej. `new Date(Date.UTC(y, m, 0)).getUTCDate()`).
- [x] 6. Salida: tabla por consola por cliente/mes + totales + "N a insertar, M a actualizar, K a borrar". Escritura con `db.batch([...])` (`neon-http` sin transacciones interactivas), en lotes de ≤ 100.
- [x] 7. `balances.ts` (collected/adjusted/totalCollected, kind `ajuste`), Inicio, Cuentas corrientes, estado de cuenta, PDF.
- [x] 8. Cobros: badge + filtro; formulario con Tipo; zod `kind`.
- [ ] 9. Correr el script en modo simulación, mostrar el resultado al usuario y **aplicar solo con su OK** (base de producción). Anotar en `specs/MEMORIA.md`: "Deuda histórica saldada con ajustes `source='saldo-historico'` hasta MM/AAAA (script `db:saldar-historico`)".

## Verificación
- `npx tsc --noEmit` · `npm run lint` · `npm run build`
- Simulación: `npm run db:saldar-historico -- --hasta 2026-08` → revisar que el total de Conocer ≈ $181M y que no escribió nada (contar filas de `collection` antes/después).
- Idempotencia sin tocar producción de más: crear un cliente de prueba "ZZ Prueba T-013" con 2 recorridos en un mes viejo, correr `--cliente <id> --hasta ... --aplicar` dos veces (2.ª = 0 cambios), editar un precio y volver a correr (1 actualización), verificar saldo 0 en su estado de cuenta, y **borrar** cliente, recorridos y ajustes de prueba.
- Pantallas: Inicio "Cobrado del mes" no cambia tras aplicar; Cuentas corrientes muestra Ajustes; estado de cuenta y PDF de Conocer muestran las líneas de ajuste; `/finanzas/cobros?tipo=ajuste` las lista.

## Fuera de alcance
- Botón en la UI para generar ajustes históricos (es una operación de una sola vez; se hace por script).
- Saldo inicial como concepto separado (un único movimiento "saldo anterior"): se resuelve con ajustes mensuales.
- Ajustes sobre saldos de estaciones de combustible (Axion/Shell).
- Reportes nuevos de cobranza.

## Preguntas abiertas
Ninguna bloquea la implementación (el script es parametrizable y simula por defecto), pero hay que responderlas **antes de correrlo con `--aplicar`**:
1. **¿Cobro o ajuste?** Recomendado: **ajuste** distinguible (`kind='ajuste'`), para que "Cobrado" refleje plata realmente recibida y no se inflen los reportes con ~$181M.
2. **¿A qué clientes?** Recomendado: **solo Viajes Conocer** (es de quien el usuario afirma que pagó todo). La simulación con `--todos-legacy` lista la deuda de los demás clientes importados (Huentata, Impulsa Mendoza, particulares, etc.) para que el usuario decida caso por caso con `--cliente`.
3. **¿Hasta qué mes?** Recomendado: **hasta el último mes cerrado antes de usar el ERP = agosto 2026** (`--hasta 2026-08`). Septiembre 2026 en adelante se lleva con cobros reales. Confirmar si los recorridos de sept/2026 (si los hay importados) ya fueron cobrados.
4. **¿Script o UI?** Recomendado: **script único idempotente** con simulación por defecto; no se agrega botón en la UI.

**Respuestas del usuario (2026-09-28):** 1) ajuste distinguible · 2) solo Viajes Conocer · 3) hasta agosto 2026 · 4) script (default de la spec). El implementador **no** corre `--aplicar` en producción; solo la simulación.

---

## Notas de implementación
- Migración `drizzle/0002_collection_kind.sql` (aditiva: enum `collection_kind`, `kind` default `'cobro'` NOT NULL, `source`, `period`, índice único `collection_source_idx`), aplicada con `db:migrate`.
- `COLLECTION_KINDS`, `CollectionKind` y `COLLECTION_KIND_LABELS` viven en `src/lib/constants.ts` y `schema.ts` los reexporta (mismo patrón que `FUEL_SUPPLIERS`), así los componentes cliente no importan valores de `@/db/schema`.
- Lógica pura en `src/lib/statement.ts` (testeada en `statement.test.ts`): `buildStatement` distingue `ajuste` (descripción "Ajuste – {notas}", `totalCollected` solo cobros), `lastDayOfMonth`, `planHistoricAdjustments` (insertar/actualizar/borrar/sin cambios). El script la importa (no tiene `server-only`).
- `getBalances` usa `sum(...) filter (where kind = ...)` y devuelve `adjusted`. `getStatement` sigue descontando cobros + ajustes en el saldo anterior.
- Estado de cuenta: StatCard "Cobrado en el período" usa `totalCollected` con hint "Ajustes: $X"; badge por tipo. PDF: "Pagos recibidos" = solo cobros + fila "Ajustes" si hay. Líneas de ajuste sin controles de edición (el estado de cuenta no tenía controles por línea); se editan/borran desde `/finanzas/cobros`.
- Cuentas corrientes: columna "Ajustes" y StatCard "Total ajustes" (4 tarjetas).
- Cobros: columna Tipo (badge "Ajuste"), filtro `?tipo=cobro|ajuste`, campo Tipo en el formulario (`z.enum(COLLECTION_KINDS)`, default `cobro`); `saveCollection` no toca `source`/`period`. El hint del monto ya no sugiere negativos para ajustes.
- Script `scripts/saldar-historico.ts` (`npm run db:saldar-historico`): los ajustes existentes del script se identifican por `period` (no por fecha). Escrituras con `db.batch` en lotes de 100. **No** se corrió `--aplicar` (base de producción); queda pendiente con OK del usuario, y luego anotar en MEMORIA la línea del paso 9.
- Idempotencia verificada por tests de `planHistoricAdjustments`; no se creó el cliente de prueba en producción (no se corrió `--aplicar`).
- Simulación (2026-09-28, `--hasta 2026-08`): Viajes Conocer 16 meses (01/2025–04/2026), total $181.871.000, 16 a insertar. Con `--todos-legacy`: 9 clientes (8 con importes), total $198.588.500, 29 a insertar (Particular $13.060.000, Impulsa Mendoza $1.400.000, Privado $870.000, Iglesia $510.000, Escuela $472.500, Testigos $225.000, Marilin $180.000). La tabla `collection` estaba vacía antes y después (0 filas): no se escribió nada.
- Verificación: `npm test` (30 ok), `tsc`, `lint` y `build` OK.
- Hallazgo 1 (revisor): el script cuenta como `collected` solo cobros con `source is null` (un ajuste del script pasado a "cobro" desde la UI ya no se cuenta dos veces; sigue contando como ajuste existente por `period`), y el upsert fija `kind: "ajuste"` en el `set`.
- Hallazgo 2 (revisor): el pie de `/finanzas/cobros` muestra "Total cobrado" y "Total ajustes" por separado (con filtro de tipo, solo el que corresponde).
- Hallazgo 3 (revisor): `deleteCollection` responde "Movimiento eliminado" (neutro). Re-verificado: test (30 ok), `tsc` y `lint` OK.

## Revisión
**Veredicto: APROBADO** (2026-09-28)
- Criterios: CA1–CA10 ✅. CA6: aplicado 2026-09-28 con `--hasta 2026-08 --todos-legacy --aplicar` (el usuario cambió el alcance a **todos** los clientes): 29 ajustes, $198.588.500; segunda corrida "0 cambios".
- Verificado: "Cobrado" excluye ajustes en Inicio, cuentas corrientes, estado de cuenta y PDF; el saldo sí los descuenta. Índice único no choca con cobros de `source` NULL. El script solo escribe con `--aplicar`. Acciones con `checkPermission` y `z.enum(COLLECTION_KINDS)`.
- Hallazgos (MENORES, corregidos): 1) doble conteo si un ajuste del script se pasaba a "cobro" → `collected` filtra `source is null` y el upsert fija `kind: "ajuste"`. 2) Pie de `/finanzas/cobros` sumaba cobros + ajustes → dos totales. 3) "Cobro eliminado" → "Movimiento eliminado".
- tsc/lint OK · npm test 30/30.
