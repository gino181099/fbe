# T-012 · Tests automáticos de la lógica crítica (Vitest)

- Estado: Implementada <!-- Borrador → Aprobada → Implementada -->
- Prioridad: Alta
- Fecha: 2026-09-28
- Tarea: `specs/TAREAS.md` → T-012

## Contexto
No hay tests automáticos. Errores de lógica pura (ej. `parseAmount("50.000")` → 50) o del versionado de tarifas / estado de cuenta solo se detectan a mano, y la única base disponible es la de **producción** (Neon). Hace falta una red mínima de pruebas que corra sin tocar la base.

## Objetivo
Poder correr `npm test` y verificar en segundos, sin conexión a ninguna base, `parseAmount`, `formatMoney`, `addDays`, el plan de cambios de `applyNewRates` y el armado del estado de cuenta de `getStatement`.

## Estrategia para lo que toca la base (decisión)
Opciones evaluadas:
1. **Extraer la lógica pura** a funciones sin `db` ni `server-only` y testear eso. → **Elegida**: cero dependencias nuevas de infraestructura, cero riesgo de tocar producción, tests rápidos y deterministas.
2. Mock de `db` (vi.mock de `@/db`): frágil (hay que imitar el query builder encadenado de Drizzle) y termina testeando el mock.
3. PGlite + migraciones de `drizzle/`: prueba el SQL real (incluido `recalculateTripPrices`), pero suma dependencia, cambio de driver (`neon-http` → `pglite`) e inyección de `db`. Queda para una tarea futura (ver "Fuera de alcance").

Refactor propuesto (sin cambio de comportamiento):
- `applyNewRates` = `ratesInForce` (DB) → **`planRateChanges(current, validFrom, items)`** (puro) → traducir el plan a queries + `db.batch`.
- `getStatement` = consultas (DB) → **`buildStatement(opening, tripRows, collectionRows)`** (puro) → `{ opening, lines, totalDebit, totalCredit, closing }`.
- Las funciones puras viven en archivos **sin** `import "server-only"` ni `@/db` (si no, Vitest falla al importarlas).

## Criterios de aceptación
- [x] CA1 `npm test` corre Vitest una vez (sin watch) y termina con código 0; `npm run test:watch` queda disponible.
- [x] CA2 Los tests no requieren `.env.local` ni `DATABASE_URL`: ningún archivo de test importa (directa o transitivamente) `@/db`, `server-only` ni `@neondatabase/serverless`.
- [x] CA3 `parseAmount`: cubre "50.000"→50000, "1.500.000,50"→1500000.5, "1500.5"→1500.5, "$ 200000"→200000, "-1.000"→-1000, "1.500,50"→1500.5, ""/"  "→null, "abc"→null.
- [x] CA4 `formatMoney`: entero sin decimales ("$ 150.000"), con centavos ("$ 150.000,50"), `null`/`undefined`→"—" (comparar normalizando el espacio no separable ` ` que emite `Intl`).
- [x] CA5 `addDays`: -1 cruzando mes (`2025-03-01`→`2025-02-28`), año bisiesto (`2024-03-01`→`2024-02-29`) y cruce de año.
- [x] CA6 `planRateChanges`: (a) sin tarifa vigente → solo alta con `validTo: null`; (b) con vigente desde fecha anterior → cierre de la vieja con `validTo = validFrom − 1 día` + alta nueva que hereda el `validTo` de la vieja (null o fecha); (c) vigente que empieza el mismo `validFrom` → solo actualización de precio, sin alta; (d) matching por recorrido **y** capacidad (misma ruta, otra capacidad no se cierra); (e) lista vacía → plan vacío.
- [x] CA7 `buildStatement`: saldo anterior = facturado previo − cobrado previo; orden por fecha y, en la misma fecha, recorridos antes que cobros; saldo corrido línea a línea; `closing`, `totalDebit`, `totalCredit` correctos; cobro negativo (ajuste) aumenta el saldo; descripción "Ruta (14 plazas) · 15 pax", fallback a `routeText` y a "Recorrido", y "Cobro (método) – nota".
- [x] CA8 `applyNewRates` y `getStatement` mantienen firma y comportamiento; sus consumidores (`contactos/actions.ts`, `finanzas/cuentas/[id]/page.tsx`, `api/estado-cuenta/[clientId]/route.tsx`, `statement-pdf.tsx`) no cambian.
- [x] CA9 `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan (los tests no rompen el build de Next).

## Diseño
### Datos
Sin cambios de esquema.
### Permisos
No aplica.
### Archivos
- `package.json` — devDependency `vitest`; scripts `"test": "vitest run"`, `"test:watch": "vitest"`.
- `vitest.config.ts` (nuevo, raíz) — `environment: "node"`, `include: ["src/**/*.test.ts"]`, alias `@` → `./src` vía `resolve.alias` con `fileURLToPath(new URL("./src", import.meta.url))` (sin plugin extra).
- `src/lib/rates-plan.ts` (nuevo, puro) — `export type RateInForce = { id; routeId; capacity; validFrom; validTo }`; `export function planRateChanges(current, validFrom, items)` que devuelve `{ updatePrice: {id, price}[], close: {id, validTo}[], insert: {routeId, capacity, price, validFrom, validTo}[] }`. Importa `addDays` de `./format` y `type NewRate` (mover `NewRate` acá y reexportarlo desde `rates.ts`).
- `src/lib/rates.ts` — `applyNewRates` usa `planRateChanges` y convierte el plan en queries (`update` precio, `update` validTo, `insert` con `clientId`) + `recalculateTripPrices` si corresponde + `db.batch`. Mismo orden lógico que hoy.
- `src/lib/statement.ts` (nuevo, puro) — mover `StatementLine` acá (reexportar desde `balances.ts`); tipos `StatementTripRow` / `StatementCollectionRow` (solo campos usados: date, route, routeText, passengers, capacity, price / date, method, notes, amount); `export function buildStatement(opening, tripRows, collectionRows)`.
- `src/lib/balances.ts` — `getStatement` hace las consultas, calcula `opening` y delega en `buildStatement`; devuelve `{ client, from, to, ...resultado }` igual que hoy.
- `src/lib/parse-amount.test.ts`, `src/lib/format.test.ts`, `src/lib/rates-plan.test.ts`, `src/lib/statement.test.ts` (nuevos).
- `tsconfig.json` — solo si hace falta para tipos de Vitest (preferir `import { describe, it, expect } from "vitest"` explícito, sin `globals`).
### UI
Sin cambios.

## Plan
- [x] 1. `npm i -D vitest`; agregar scripts `test` y `test:watch`; crear `vitest.config.ts`.
- [x] 2. Tests de `parseAmount`, `formatMoney`, `addDays` (CA3–CA5); correr `npm test`.
- [x] 3. Crear `src/lib/rates-plan.ts` con `planRateChanges` + mover `NewRate`; refactorizar `applyNewRates` para usarlo (CA8).
- [x] 4. Tests de `planRateChanges` (CA6).
- [x] 5. Crear `src/lib/statement.ts` con `buildStatement` + mover `StatementLine`; refactorizar `getStatement` (CA8).
- [x] 6. Tests de `buildStatement` (CA7).
- [x] 7. Verificar que ningún test importe `@/db`/`server-only` (CA2): correr `npm test` sin `.env.local` cargado (Vitest no lo carga por defecto).
- [x] 8. `npx tsc --noEmit` · `npm run lint` · `npm run build`.
- [x] 9. Agregar a `specs/MEMORIA.md` (Decisiones técnicas): "Tests con Vitest sobre lógica pura extraída (`rates-plan.ts`, `statement.ts`); los archivos con `server-only`/`@/db` no se testean directo."; y actualizar la línea "No hay tests automáticos todavía" de `CLAUDE.md` si el usuario lo autoriza (lo decide el orquestador).

## Verificación
- `npm test` (todo verde) · `npx tsc --noEmit` · `npm run lint` · `npm run build`
- Prueba manual de no-regresión (sin crear datos): abrir `/finanzas/cuentas/<id>` de Viajes Conocer y descargar el PDF; saldo anterior, líneas y saldo final iguales a antes del refactor (comparar con captura previa).
- Versionado: probar en la app solo si ya hay un cliente de prueba; si se crea uno, **borrarlo** al terminar (la base es producción).

## Fuera de alcance
- Tests de integración con base real (PGlite o rama de Neon) — cubrirían `recalculateTripPrices`, `findRate`, `getBalances` y las queries de `getStatement`. Candidato a tarea futura.
- Tests de server actions, permisos, UI/componentes, PDF y E2E.
- CI (Bitbucket Pipelines / Vercel) que corra `npm test`.
- Cobertura mínima obligatoria.

## Preguntas abiertas
- Ninguna bloqueante.
- (No bloqueante) ¿Se quiere que `npm run build` en Vercel corra antes `npm test`? Por defecto no se toca el build.

---

## Notas de implementación
- Archivos: `package.json` (vitest 5 devDep + scripts `test`/`test:watch`), `vitest.config.mts` (nuevo), `src/lib/rates-plan.ts` y `src/lib/statement.ts` (nuevos, puros), `src/lib/rates.ts` y `src/lib/balances.ts` (refactor; reexportan `NewRate` y `StatementLine`), 4 archivos `src/lib/*.test.ts` (27 tests), `CLAUDE.md` (comandos + línea de tests, autorizado), `specs/MEMORIA.md`.
- Desvío: la config quedó como `vitest.config.mts` (no `.ts`): con `.ts` Vite avisa "ESM syntax in a file loaded as CommonJS" porque el paquete no es `"type": "module"`. `tsconfig` ya incluye `**/*.mts`.
- `applyNewRates` ahora arma el batch agrupado (actualizaciones de precio → cierres → altas → recálculo) en vez de intercalado por ítem; cada query toca filas distintas y todo corre en el mismo `db.batch`, así que el resultado es idéntico.
- `buildStatement` recibe `opening` ya calculado; CA7 "saldo anterior" se prueba como facturado previo − cobrado previo pasado a `opening` (la resta sigue en `getStatement`).
- CA2: los tests solo importan `./parse-amount`, `./format`, `./rates-plan`, `./statement`; `npm test` corre sin `DATABASE_URL`.
- Verificación: `npm test` 27/27 · `tsc` · `lint` · `build` OK. No se tocó la base; prueba manual del PDF pendiente para el usuario.

## Revisión
**Veredicto: APROBADO** (2026-09-28)
- Criterios CA1–CA9 ✅ (build informado por el implementador).
- Batch agrupado en `applyNewRates`: equivalente. `rate` solo tiene el índice no único `rate_lookup_idx`; los tres grupos (update de precio / cierre / alta) tocan filas distintas; `recalculateTripPrices` sigue al final del mismo `db.batch`.
- `getStatement`/`buildStatement`: saldo anterior, orden (fecha; recorridos antes que cobros el mismo día; sort estable) y saldo final equivalentes.
- Salvedad: sin commits previos no hubo diff; falta la prueba manual del PDF de Viajes Conocer.
- Hallazgos: ninguno. `npm test` 27/27 OK sin DATABASE_URL · tsc/lint OK.
