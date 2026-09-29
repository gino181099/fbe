# T-016 · Gráficos e informes de Inicio: gastos correctos + filtros de fecha y cliente

- Estado: Implementada
- Prioridad: Media
- Riesgo: Alto <!-- cambia la definición de montos mostrados (gastos/margen) → lleva revisor -->
- Fecha: 2026-09-28
- Tarea: `specs/TAREAS.md` → T-016

## Contexto
La "Evolución mensual" de Inicio (T-014) toma "Gastos" **solo de la tabla `expense`** (`getMonthlyTotals` en `src/lib/reports.ts`). Pero los costos que el usuario ve en /ventas viven en `trip` (`driver_pay`, `fuel_pesos`, `extra_payments` = "Costos directos", y /ventas calcula Margen = facturado − esos costos), y las cargas extras de combustible viven en `fuel_load`. En 2026 el gasoil y los pagos a choferes se cargan en los recorridos, así que en Inicio "Gastos" queda en 0 (o muy bajo) y el Margen no coincide con /ventas. La agrupación con `to_char(date,'YYYY-MM')` sobre columnas `date` es correcta (no hay problema de zona horaria) y no es la causa.
Además, el período es fijo (últimos 12 meses) y no se puede filtrar por cliente.

## Objetivo
En Inicio el usuario ve gastos y margen coherentes con /ventas, y puede elegir un rango de fechas y un cliente para el gráfico y las tablas de informes.

## Criterios de aceptación
- [x] CA1 "Gastos" por mes = Costos directos (Σ `driver_pay` + `fuel_pesos` + `extra_payments` de `trip`, nulls como 0) + Gastos generales (Σ `expense.amount` con `category <> 'combustible'` + Σ `fuel_load.pesos`). Los gastos categoría `combustible` (pagos a estación) **no** se suman, para no contar dos veces el gasoil (ver D1).
- [x] CA2 Para un mes de 2026 sin filtro de cliente, la columna "Costos directos" de Inicio es igual a "Costos directos" de `/ventas?desde=<1ro del mes>&hasta=<último día>`, y "Margen" de Inicio = Facturado − Gastos.
- [x] CA3 La tabla mensual muestra columnas Facturado, Cobrado, Costos directos, Gastos generales, Gastos (total) y Margen; el gráfico mantiene 4 series (Facturado, Cobrado, Gastos, Margen).
- [x] CA4 Form GET con `desde` y `hasta` (`<Input type="date">`) + select `cliente` + botones "Filtrar" y "Limpiar" (este último solo si hay filtros). Sin parámetros: desde = 1ro del mes de hace 11 meses, hasta = hoy (igual que hoy en día).
- [x] CA5 Fechas inválidas se ignoran (se usa el default); si `desde > hasta` se intercambian; el rango se limita a 36 meses (se recorta `desde`), mostrando el período efectivo en el subtítulo ("ene 2026 – sep 2026").
- [x] CA6 Los meses del gráfico/tabla cubren exactamente los meses entre `desde` y `hasta` (incluyendo meses sin movimientos en 0). Los meses de borde se suman solo con días dentro del rango.
- [x] CA7 Con `cliente` elegido se filtran por `client_id`: Facturado, Cobrado (solo `kind='cobro'`), Costos directos y "Recorridos más vendidos". Gastos generales no tienen cliente: con cliente elegido esa columna/serie queda en `null` (no se muestra) y Gastos = Costos directos; aparece la nota "Con un cliente elegido, Gastos incluye solo los costos directos de sus recorridos."
- [x] CA8 Permisos: Facturado y Costos directos requieren `ventas`; Cobrado y Gastos generales requieren `finanzas`. Gastos = suma de los componentes visibles; Margen se muestra si el usuario tiene `ventas` (Facturado − Gastos visibles). Las series sin permiso quedan `null` como hoy.
- [x] CA9 "Recorridos más vendidos" usa el mismo rango y cliente, y su título dice el período ("Recorridos más vendidos (ene 2026 – sep 2026)"); el EmptyState de ambas secciones menciona "en el período elegido".
- [x] CA10 Las StatCards del mes actual, "Últimos recorridos" y "Clientes con mayor saldo" no cambian (no se filtran).
- [x] CA11 Tests Vitest en `src/lib/monthly.test.ts` cubren: `monthsBetween`, `resolveRange` (default, inválidas, swap, tope 36 meses) y `buildMonthlySeries` con las series nuevas (suma de gastos, `null` por permiso/cliente, margen).

## Diseño
### Datos
Sin cambios de esquema. Solo consultas de lectura sobre `trip`, `collection`, `expense`, `fuel_load`.
### Permisos
Página Inicio sigue con `requireUser()`; cada serie según `can(user, "ventas")` / `can(user, "finanzas")` (CA8). El select de clientes se muestra si el usuario tiene `ventas` o `finanzas`.
### UI
En la sección "Evolución mensual", arriba del gráfico: form GET (mismo estilo que el de `/ventas`: labels "Desde"/"Hasta", `NativeSelect` "Todos los clientes", botón secondary "Filtrar", ghost "Limpiar" → `/`). Subtítulo: período efectivo + nombre del cliente si hay. Columnas nuevas en la tabla mensual y fila Total.

## Mapa de código
- `src/lib/monthly.ts` › `lastMonths` (~15) — agregar `monthsBetween(from, to)` ("YYYY-MM" inclusive) y `resolveRange(desde?, hasta?, todayIso)` → `{ from, to, months }` (default, validación `YYYY-MM-DD`, swap, tope 36 meses). `lastMonths` puede quedar (se usa en el default).
- `src/lib/monthly.ts` › `MonthlyRow` / `buildMonthlySeries` (~4, ~34) — series de entrada `billed | collected | directCosts | generalExpenses`; fila agrega `directCosts`, `generalExpenses`; `expenses` = suma de componentes no-null (null si ambos null); `margin` = billed − expenses si billed y expenses no son null. `totalsOf` (~56) sumar las claves nuevas.
- `src/lib/reports.ts` › `getMonthlyTotals` (~9) — firma `(from, to, { sales, finance }, clientId?)`; agregar consulta de costos directos sobre `trips` (`sum(coalesce(driver_pay,0)+coalesce(fuel_pesos,0)+coalesce(extra_payments,0))`, patrón `sumOf` en `src/lib/balances.ts:7`), filtrar trips/collections por `clientId`; gastos generales = dos consultas (`expenses` con `ne(category,'combustible')` y `fuelLoads` por mes) devueltas como una sola serie concatenada (el `lookup` de `buildMonthlySeries` ya suma meses repetidos); `null` si `!finance || clientId`. Importar `fuelLoads`, `ne`.
- `src/lib/reports.ts` › `getTopRoutes` (~41) — agregar `clientId?` opcional al `where`.
- `src/app/(app)/page.tsx` › `DashboardPage` (~16) — recibir `{ searchParams }: PageProps<"/">`, leer `desde/hasta/cliente` (helpers `str`/`isDate` como en `src/app/(app)/ventas/page.tsx:22-23`), usar `resolveRange`; pasar rango/cliente a `getMonthlyTotals` y `getTopRoutes`; traer lista de clientes (`id, name` orden `asc(name)`) si `canSales || canFinance` (reutilizar/ajustar `clientRows` ~60, que hoy solo se trae con finanzas); columnas nuevas (~126-151); textos de subtítulo/EmptyState (~115, ~118, ~163, ~169).
- `src/components/monthly-chart.tsx` — sin cambios de lógica (sigue usando `expenses` y `margin`); verificar que compile con el nuevo `MonthlyRow`.
- Patrón a imitar: form de filtros en `src/app/(app)/ventas/page.tsx:127-176`.
- Tests: `src/lib/monthly.test.ts` (ya existe; actualizar los casos de `buildMonthlySeries`).

## Plan
- [x] 1. `monthly.ts`: `monthsBetween`, `resolveRange`, nuevo `MonthlyRow`/`buildMonthlySeries`/`totalsOf`; actualizar y ampliar `monthly.test.ts` (`npm test`).
- [x] 2. `reports.ts`: `getMonthlyTotals` con costos directos, gastos generales (expense sin combustible + fuel_load) y `clientId`; `getTopRoutes` con `clientId`.
- [x] 3. `page.tsx`: searchParams, form de filtros, lista de clientes, columnas y textos nuevos.
- [x] 4. `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.

## Verificación
- `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build` (una vez, al final)
- Manual (solo lectura, no hace falta crear datos): abrir `/` y comparar un mes de 2026 (ej. agosto) con `/ventas?desde=2026-08-01&hasta=2026-08-31`: Facturado y Costos directos iguales (CA2). Probar `/?desde=2025-03-10&hasta=2025-01-01` (swap), `/?desde=2020-01-01` (tope 36 meses), `/?cliente=<id Viajes Conocer>` (Gastos generales ocultos, nota visible, top recorridos filtrado).
- Antes de cerrar, anotar en Notas de implementación los totales de un mes de 2026 por componente (expense por categoría, fuel_load, costos de trips) para confirmar la causa.

## Fuera de alcance
- Filtros por chofer/vehículo/recorrido en Inicio.
- Exportar el informe (Excel/PDF).
- Cambiar las StatCards "del mes" o la sección de saldos.
- Imputar gastos generales a clientes (prorrateo).

## Decisiones propuestas
- D1 ¿Qué combustible cuenta como gasto? — **Por defecto:** consumo = gasoil de recorridos (`trip.fuel_pesos`) + cargas extras (`fuel_load.pesos`); los gastos categoría `combustible` (pagos a Axion/Shell) se excluyen porque son pago de ese mismo consumo. · Alternativa: contar los pagos a estación (`expense` combustible) y excluir `fuel_pesos`/`fuel_load` (criterio de caja: puede dar 0 en meses sin pago). ✅ Usuario: por defecto (consumo).
- D2 ¿Los gastos categoría `sueldo` se suman además del "Pago al chofer" de los recorridos? — **Por defecto:** sí (se asume que sueldos son fijos/mensuales, distintos del pago por viaje). · Alternativa: excluir `sueldo` con `driver_id` para no duplicar si esos sueldos son la liquidación de los pagos por viaje. ✅ Usuario: por defecto (se suman).
- D3 ¿Qué margen se muestra? — **Por defecto:** Facturado − Gastos (costos directos + generales), y la tabla muestra ambos componentes, así el de /ventas se puede comparar con "Facturado − Costos directos". · Alternativa: dos series de margen (bruto = /ventas, neto = con generales). ✅ Usuario: por defecto (facturado − gastos totales).
- D4 ¿Las StatCards "del mes" también siguen el filtro de cliente? — **Por defecto:** no (CA10). · Alternativa: filtrarlas por cliente. ✅ Usuario: por defecto (aprobado junto con la spec).

## Preguntas bloqueantes
- Ninguna

---

## Notas de implementación
- **Causa confirmada** (consulta de solo lectura, 2026-09-28): en 2026 `expense` y `fuel_load` no tienen ninguna fila; todos los costos están en `trip`. Ene 2026: 62 recorridos, facturado $19.013.000, chofer $2.000.000 + gasoil $3.820.881,25 + adicionales $3.000 = costos directos $5.823.881,25 (Inicio mostraba Gastos $0). Feb: $10.206.000 / $1.408.000 + $2.144.569,56. Mar: $5.978.000 / $1.025.000 + $1.360.097,53. Abr: $4.583.000 / $730.000 + $1.045.110,80. No hay recorridos desde mayo 2026.
- `monthly.ts`: `monthsBetween`, `resolveRange` (valida que el día exista, ej. `2026-02-31` se ignora), `MAX_MONTHS = 36`. Decisión: si solo viene `hasta`, `desde` por defecto = 1ro del mes 11 meses antes de `hasta` (y no de hoy), así `/?hasta=2025-06-30` muestra 12 meses.
- `reports.ts`: una sola consulta sobre `trip` devuelve facturado y costos directos por mes; gastos generales = `expense` sin combustible + `fuel_load`, concatenadas (null si no hay finanzas o hay cliente). `getTopRoutes(from, to, clientId?, limit)`: cambió el orden de parámetros (solo se usaba en Inicio).
- `page.tsx`: el form tiene `key` derivada del rango/cliente (reset de React 19 al usar Limpiar). El select de clientes excluye los `potencial` (no tienen recorridos). La columna Gastos se oculta si no queda ningún componente visible (usuario solo finanzas con cliente elegido); la nota de CA7 se muestra solo si el usuario tiene ventas y finanzas (sin ventas no hay costos directos que mostrar). Margen ahora se muestra con solo `ventas` (antes pedía ventas + finanzas), según CA8.
- CA2: la fórmula de costos directos es la misma que la StatCard de `/ventas` (Σ chofer + Σ gasoil + Σ adicionales, nulls = 0). No se probó en el navegador.
- Archivos: `src/lib/monthly.ts`, `src/lib/monthly.test.ts`, `src/lib/reports.ts`, `src/app/(app)/page.tsx`. Sin cambios de esquema ni de datos. `monthly-chart.tsx` sin cambios.
- Verificación: tsc · lint · test 65/65 · build OK.

## Revisión
Veredicto: APROBADO
Criterios: CA1 ✅ · CA2 ✅ (misma fórmula que ventas/page.tsx:91) · CA3 ✅ · CA4 ✅ · CA5 ✅ · CA6 ✅ · CA7 ✅ · CA8 ✅ · CA9 ✅ · CA10 ✅ · CA11 ✅
Hallazgos:
1. [MENOR] src/app/(app)/page.tsx:~217 — Sin `finanzas`, `generalExpenses` es null en el servidor (reports.ts: `general = finance && !clientId`), así que el Margen de un usuario solo-ventas es Facturado − Costos directos; no se filtra ningún monto de finanzas. Consecuencia: el mismo mes muestra un margen distinto según el permiso (bruto vs neto). No es una fuga; conviene anotarlo como comportamiento conocido en MEMORIA.
2. [MENOR] page.tsx:~41 — `?cliente=<id de un cliente potencial>` filtra los datos pero `clientName` queda undefined (el select excluye potenciales), así que el subtítulo no muestra el cliente. Caso marginal, solo por URL manual.
