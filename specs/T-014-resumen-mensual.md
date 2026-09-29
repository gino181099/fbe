# T-014 · Resumen mensual con gráficos en Inicio

- Estado: Implementada <!-- Borrador → Aprobada → Implementada -->
- Prioridad: Media
- Fecha: 2026-09-28
- Tarea: `specs/TAREAS.md` → T-014

## Contexto
Inicio (`src/app/(app)/page.tsx`) solo muestra números del mes en curso. Para seguir el negocio (inflación, estacionalidad del turismo) hace falta ver la evolución mes a mes de lo facturado, lo cobrado, lo gastado y el margen, y qué recorridos se venden más.

## Objetivo
Al entrar a Inicio, el usuario ve un gráfico de barras con los últimos 12 meses (facturado, cobrado, gastos y margen), una tabla con esos valores y un ranking de los recorridos más vendidos del mismo período, según sus permisos.

## Criterios de aceptación
- [ ] CA1 Inicio muestra la sección "Evolución mensual" con los últimos 12 meses **incluido el mes en curso** (del mes actual −11 al actual, calculado con `today()` en zona AR), ordenados de más viejo a más nuevo; los meses sin datos aparecen en 0 (no se saltean).
- [ ] CA2 Por mes: **Facturado** = Σ `trip.price` con fecha en el mes; **Cobrado** = Σ `collection.amount` con `kind='cobro'` (los ajustes no cuentan); **Gastos** = Σ `expense.amount` con fecha en el mes (todas las categorías); **Margen** = Facturado − Gastos.
- [ ] CA3 Los totales del mes en curso del gráfico coinciden con las tarjetas "Facturado del mes" y "Cobrado del mes" existentes.
- [ ] CA4 Hay un gráfico de barras agrupadas por mes (una barra por serie visible, colores distintos, leyenda), con el valor exacto en tooltip nativo (`title`) formateado con `formatMoney`; el margen negativo se dibuja distinto (ej. color rojo / barra hacia abajo) o al menos se ve en rojo en la tabla.
- [ ] CA5 Debajo del gráfico, una tabla con Mes ("oct 2025"), Facturado, Cobrado, Gastos, Margen y una fila de Total de los 12 meses.
- [ ] CA6 "Recorridos más vendidos (últimos 12 meses)": top 10 por cantidad de recorridos, con columnas Recorrido, Cantidad y Facturado; el nombre es `route.name` o, si no hay ruta, `trip.route_text`; si ambos son nulos, "Sin especificar". Empates se ordenan por facturado desc.
- [ ] CA7 Permisos: usuario con `ventas` ≥ view ve Facturado y el ranking; con `finanzas` ≥ view ve Cobrado y Gastos; Margen solo si tiene ambos. Sin ninguno de los dos, la sección no aparece y no se ejecutan esas consultas.
- [ ] CA8 Sin datos en todo el período se muestra `EmptyState` ("Sin movimientos en los últimos 12 meses.") en vez del gráfico.
- [ ] CA9 No se agregan dependencias nuevas a `package.json` (gráfico hecho con HTML/CSS o SVG server-rendered).
- [ ] CA10 Hay tests Vitest de la lógica pura (lista de meses, relleno con ceros y cálculo de margen, cruce de año dic→ene).
- [ ] CA11 `npx tsc --noEmit`, `npm run lint`, `npm test` y `npm run build` pasan.

## Diseño
### Datos
Sin cambios de esquema. Consultas agregadas con `group by to_char(date, 'YYYY-MM')` sobre `trip`, `collection` y `expense` filtradas por `date >= <primer día del mes −11>` y `date <= today()` (índices `trip_date_idx` y `expense_date_idx` existentes; `collection` no tiene índice por fecha, volumen chico: aceptable).

### Permisos
Solo lectura. Página con `requireUser()` como hoy; cada serie condicionada con `can(user, "ventas")` / `can(user, "finanzas")` (ver CA7). Sin server actions.

### Archivos
- `src/lib/monthly.ts` (nuevo, **puro**, sin `@/db`) — `lastMonths(endIso: string, n = 12): string[]` → `["2025-10", …, "2026-09"]`; `buildMonthlySeries(months, { billed, collected, expenses }: Record<"billed"|"collected"|"expenses", {month: string; total: number}[] | null>)` → `{ month, billed, collected, expenses, margin }[]` (null = serie sin permiso → valores `null`; margin `null` si falta billed o expenses); `formatMonth("2026-09")` → "sep 2026" (sin pasar por `Date` con zona, o con `T12:00:00`).
- `src/lib/monthly.test.ts` (nuevo) — tests de CA10.
- `src/lib/reports.ts` (nuevo, `import "server-only"`) — `getMonthlyTotals(from, to, { sales, finance })` (3 consultas en `Promise.all`, usa `sumOf` de `balances.ts`) y `getTopRoutes(from, to, limit = 10)` (join `routes` left, group by `coalesce(route.name, trip.route_text)`, `count()` y `sumOf(trips.price)`).
- `src/components/monthly-chart.tsx` (nuevo, server component, sin `"use client"`) — barras agrupadas con divs/Tailwind: altura proporcional al máximo absoluto del período, leyenda, etiqueta de mes abajo, `title` con el monto; scroll horizontal en mobile (`overflow-x-auto`). Recibe solo las series visibles.
- `src/app/(app)/page.tsx` — agregar las consultas al `Promise.all` existente (condicionadas por permiso) y renderizar la sección "Evolución mensual" (gráfico + tabla) y "Recorridos más vendidos" debajo de las tarjetas, antes de "Últimos recorridos".

### UI
- Título de sección: "Evolución mensual" con subtítulo "Últimos 12 meses".
- Leyenda/series: "Facturado", "Cobrado", "Gastos", "Margen".
- Tabla: columnas numéricas `text-right tabular-nums`; margen negativo en `text-destructive`; fila "Total" en negrita.
- Ranking: tabla dentro de `rounded-xl border`, título "Recorridos más vendidos", botón ghost "Ver recorridos" → `/ventas`.

## Plan
- [x] 1. Crear `src/lib/monthly.ts` con `lastMonths`, `buildMonthlySeries`, `formatMonth`, y sus tests en `src/lib/monthly.test.ts` (incluye cruce dic→ene y serie `null`). `npm test`.
- [x] 2. Crear `src/lib/reports.ts` con `getMonthlyTotals` y `getTopRoutes`.
- [x] 3. Crear `src/components/monthly-chart.tsx` (barras CSS, leyenda, tooltips `title`, manejo de margen negativo).
- [x] 4. Integrar en `src/app/(app)/page.tsx`: calcular `from = lastMonths(today())[0] + "-01"`, `to = today()`; sumar consultas al `Promise.all` según permisos; renderizar gráfico, tabla y ranking; `EmptyState` si todo es 0.
- [x] 5. `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build`.

## Verificación
- `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build`
- Manual (sin crear datos; alcanza con los existentes):
  1. Admin en `/`: ver 12 meses, el último es el mes actual; comparar el mes actual con las tarjetas de arriba (CA3).
  2. Elegir un mes pasado y cotejar Facturado con `/ventas?desde=…&hasta=…` y Gastos con `/finanzas/gastos` filtrado por ese mes.
  3. Ranking: verificar que el primero coincide con filtrar `/ventas` por ese recorrido en el período.
  4. Con un usuario de prueba con solo `ventas: view`: ve Facturado y ranking, no Cobrado/Gastos/Margen. Borrar el usuario de prueba al terminar.

## Fuera de alcance
- Elegir otro período (selector de año o de cantidad de meses) o filtrar por cliente.
- Costos por recorrido (`driver_pay`, `fuel_pesos`, `extra_payments`) en el margen: el gasoil de recorridos se paga luego como gasto de combustible, sumarlo duplicaría (ver pregunta 1).
- Gráficos interactivos (librerías como recharts/shadcn chart), exportar a Excel/PDF.
- Desglose de gastos por categoría o por vehículo (depende de T-001).

## Preguntas abiertas
- ✅ Resuelta (usuario, 2026-09-28): **Margen** = Facturado − Gastos registrados (tabla `expense`).
- ✅ Resuelta (usuario, 2026-09-28): el ranking ordena por **cantidad** de recorridos.

---

## Notas de implementación
- Archivos nuevos: `src/lib/monthly.ts` (+ `totalsOf` para la fila Total, agregado al plan), `src/lib/monthly.test.ts` (9 tests), `src/lib/reports.ts`, `src/components/monthly-chart.tsx`. Modificado: `src/app/(app)/page.tsx`.
- Gráfico: barras con divs; escala común = máx. positivo + máx. negativo del período. Si hay valores negativos, el área se parte en una zona sobre la línea base y otra debajo, donde el margen negativo se dibuja en rojo hacia abajo (con leyenda "Margen negativo"). Tooltip `title` = "Serie mes: $ monto".
- `getMonthlyTotals` recibe `{ sales, finance }` y devuelve `null` en las series sin permiso (no ejecuta esa consulta); la página ni la llama si no hay ningún permiso.
- `EmptyState` del CA8 se muestra si todas las series visibles son 0 en los 12 meses. El ranking tiene su propio `EmptyState` ("Sin recorridos en los últimos 12 meses.").
- SQL de agrupación verificado con una consulta de solo lectura contra Neon (script temporal, borrado). Sin cambios de esquema ni dependencias.

## Revisión
Veredicto: **APROBADO**
- Criterios: CA1–CA10 ✅ · CA11 ✅ parcial (el build lo corrió el implementador: OK).
- [MENOR] `src/app/(app)/page.tsx:182`: la `key={t.name}` del ranking se puede repetir si un `route_text` vale literalmente "Sin especificar" y además hay recorridos sin ruta.
- [MENOR] `src/lib/reports.ts:42-49`: `coalesce(route.name, route_text)` agrupa juntos una ruta del catálogo y un texto libre con el mismo nombre. Así lo pide la spec, queda como aviso.
- Convenciones OK: `today()` AR, fechas como string, `formatMoney`, `monthly.ts` puro, `reports.ts` server-only, sin librerías nuevas.
