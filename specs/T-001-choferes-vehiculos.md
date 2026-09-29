# T-001 · Choferes y vehículos como entidades

- Estado: Implementada <!-- Borrador → Aprobada → Implementada -->
- Prioridad: Media
- Fecha: 2026-09-28
- Tarea: `specs/TAREAS.md` → T-001

## Contexto
Hoy el chofer de un recorrido es texto libre (`trip.driver`) y los vehículos no existen en el sistema. No se pueden asociar gastos (cuotas, seguros, services) a un vehículo ni ver cuánto cuesta/rinde cada unidad. Los datos iniciales están en `vehiculos.md` (4 unidades) y `choferes.md` (5 choferes) en la raíz del repo.

## Objetivo
El usuario administra choferes y vehículos en una pantalla "Flota", los elige al cargar recorridos y gastos, filtra Ventas y Gastos por chofer/vehículo y ve un resumen de ingresos y costos por vehículo (y recorridos por chofer) en un período.

## Criterios de aceptación
- [ ] CA1 Existen las tablas `driver` y `vehicle`; la migración crea los 5 choferes de `choferes.md` y los 4 vehículos de `vehiculos.md` (con patente, modelo y plazas), sin duplicar si se vuelve a correr el SQL.
- [ ] CA2 En `/flota` (usuario con `ventas` ≥ view) se listan choferes y vehículos; con `ventas` = edit se pueden crear, editar, activar/desactivar y borrar. Sin permiso de edición no se ven los botones y las acciones devuelven error.
- [ ] CA3 La patente se guarda en mayúsculas sin espacios y es única: cargar una repetida muestra "Ya existe un vehículo con esa patente".
- [ ] CA4 Borrar un chofer/vehículo con recorridos o gastos asociados no borra nada y muestra "Tiene movimientos asociados: desactivalo en lugar de borrarlo".
- [ ] CA5 El formulario de recorrido tiene selects "Chofer" y "Vehículo" (solo activos, más el ya asignado aunque esté inactivo); al guardar se persisten `driver_id` / `vehicle_id`.
- [ ] CA5b El vehículo es solo un dato asociado: elegir o cambiar el vehículo **no** modifica la capacidad (categoría tarifaria), la tarifa ni el precio del recorrido, ni filtra las opciones de capacidad. Ej.: un recorrido de categoría 8 (cubre 8 a 13 pax) puede hacerlo una unidad de 19 por mantenimiento y sigue cobrándose como 8.
- [ ] CA6 Los recorridos históricos cuyo texto `driver` coincide con un chofer quedan con `driver_id` (backfill en la migración); los que no coinciden siguen mostrando el texto histórico y al editarlos sin elegir chofer el texto no se pierde.
- [ ] CA7 Ventas: el filtro "Chofer" pasa a ser un select por chofer y se agrega filtro "Vehículo"; la tabla muestra el nombre del chofer (o el texto histórico) y una columna Vehículo (patente).
- [ ] CA8 El formulario de gasto tiene selects opcionales "Vehículo" y "Chofer"; Gastos permite filtrar por vehículo y muestra la patente en la tabla.
- [ ] CA9 En `/flota`, con filtro desde/hasta (por defecto mes actual), cada vehículo muestra: nº de recorridos, facturado (Σ precio), gasoil de recorridos, pago a choferes, gastos asociados y margen (facturado − todos esos costos). La sección de montos solo se ve con `finanzas` ≥ view.
- [ ] CA10 Cada chofer muestra en el período: nº de recorridos y Σ pago al chofer (sin liquidación, eso es T-007).
- [ ] CA11 Detalle de cliente (`/contactos/[id]`) muestra el nombre del chofer (o texto histórico) sin romperse.
- [ ] CA12 `npx tsc --noEmit`, `npm run lint`, `npm test` y `npm run build` pasan.

## Diseño
### Datos
Nuevas tablas en `src/db/schema.ts` (sección nueva "Flota", antes de Ventas):
- `driver`: `id` identity, `name text not null`, `phone text`, `notes text`, `active boolean not null default true`, `created_at`.
- `vehicle`: `id` identity, `plate text not null` (unique index `vehicle_plate_idx`), `model text not null` (ej. "Mercedes Benz Sprinter 517 CDI"), `seats integer not null` (plazas), `notes text`, `active boolean not null default true`, `created_at`.

Columnas nuevas (nullables, FK `onDelete: "restrict"`):
- `trip.driver_id` → `driver.id`, `trip.vehicle_id` → `vehicle.id` + índices `trip_driver_idx`, `trip_vehicle_idx`.
- `expense.driver_id` → `driver.id`, `expense.vehicle_id` → `vehicle.id` + índice `expense_vehicle_idx`.
- `trip.driver` (texto) **se mantiene** como dato histórico para lo que no matchee; no se borra.

Migración: **se genera al implementar** (`npm run db:generate -- --name flota`), no antes, porque T-014 y T-015 se especifican en paralelo y pueden agregar migraciones: generar después de tener sus cambios en el árbol para que el journal/snapshots de `drizzle/` queden en cadena. Al final del SQL generado, agregar a mano:
1. Seed idempotente:
   - Vehículos: `INSERT ... ON CONFLICT (plate) DO NOTHING` con AH115DL (Mercedes Benz Sprinter 517 CDI, 19), AG225LD (Mercedes Benz Sprinter 517 CDI, 19), AG632FM (Mercedes Benz Sprinter 414 CDI, 15), AH465DS (Toyota Hiace, 13).
   - Choferes: `INSERT ... SELECT ... WHERE NOT EXISTS (select 1 from driver where lower(name)=lower(x))` con Jose Vera, Walter Fernandez, Ricardo Nuñez, Omar Vargas, Sergio Zambudio.
2. Backfill `trip.driver_id`: antes de escribirlo, el implementador consulta (solo lectura) `select driver, count(*) from trip group by driver` para ver cómo figuran los nombres históricos. Matchear sin mayúsculas/acentos/espacios extra (`lower(trim(translate(...,'áéíóúñÁÉÍÓÚÑ','aeiounAEIOUN')))`) por nombre completo, y además por nombre de pila o apellido **solo si identifica a un único chofer**. Los alias raros se mapean explícitamente en el SQL. Reportar en Notas cuántos recorridos quedaron sin `driver_id` y con qué textos.
3. Vehículo histórico: sin backfill (no hay dato); queda null.

### Permisos
- `/flota` y sus acciones: módulo `ventas` (view para ver, edit para ABM). No se agrega módulo nuevo (evita alterar el enum `module` y la pantalla de Usuarios).
- Montos de costos/margen por vehículo en `/flota`: además `can(user, "finanzas", "view")`.
- Asignar vehículo/chofer a un gasto: permiso `finanzas` (como el resto del gasto).

### Archivos
- `src/db/schema.ts` — tablas `drivers`, `vehicles`; columnas FK en `trips` y `expenses`.
- `drizzle/XXXX_flota.sql` (+ snapshot/journal) — generado al implementar + seed y backfill manuales.
- `src/lib/constants.ts` — `VEHICLE_EXPENSE_CONCEPTS` ("Cuota", "Seguro", "Service", "Patente", "VTV", "Neumáticos", "Reparación") para datalist del concepto; `normalizePlate(s)` (mayúsculas, sin espacios ni guiones).
- `src/lib/constants.test.ts` (o el test existente de utilidades) — test de `normalizePlate`.
- `src/app/(app)/flota/page.tsx` — server; `requirePermission("ventas")`; filtro desde/hasta (form GET); tablas de vehículos y choferes con estadísticas agregadas (`sumOf`, `count`, agrupado por `vehicle_id` / `driver_id`, en consultas con `Promise.all`).
- `src/app/(app)/flota/actions.ts` — `saveDriver`, `deleteDriver`, `toggleDriver`, `saveVehicle`, `deleteVehicle`, `toggleVehicle`; `checkPermission("ventas")`; zod + `formToObject`; `seats` entero 1–60; unique de patente → mensaje de CA3; FK violation (código `23503`) → mensaje de CA4; `revalidatePath("/flota")`, `"/ventas"`, `"/finanzas", "layout"`.
- `src/app/(app)/flota/driver-form.tsx`, `src/app/(app)/flota/vehicle-form.tsx` — `FormDialog` cliente (solo `import type` de schema).
- `src/components/app-sidebar.tsx` — ítem "Flota" (`/flota`, ícono `Truck` o `Bus`, `module: "ventas"`).
- `src/app/(app)/ventas/actions.ts` — `driverId`, `vehicleId` opcionales (`z.coerce.number().int().positive().optional()`, vacío → null); si viene `driverId`, `driver` = null; si no viene, conservar el `driver` texto recibido en un hidden (histórico).
- `src/app/(app)/ventas/trip-form.tsx` — reemplazar input+datalist de chofer por `NativeSelect` de choferes y agregar `NativeSelect` de vehículo (muestra "AH115DL · Sprinter 517 (19)"); si el recorrido tiene texto histórico sin `driverId`, mostrar hint "Histórico: X" y enviarlo en hidden `driver`. El select de vehículo **no** tiene lógica asociada: no toca `capacity`, `rateId` ni `price` (no derivar nada de `seats`). Props: `drivers: {id,name,active}[]`, `vehicles: {id,plate,model,seats,active}[]`.
- `src/app/(app)/ventas/page.tsx` — leftJoin `drivers` y `vehicles`; filtros `chofer=<id>` y `vehiculo=<id>` (select); quitar el `selectDistinct` de `trips.driver`; columna Vehículo.
- `src/app/(app)/finanzas/actions.ts` — `expenseSchema` con `vehicleId`, `driverId` opcionales.
- `src/app/(app)/finanzas/fields.tsx` — selects Vehículo/Chofer en el form de gasto; datalist de conceptos.
- `src/app/(app)/finanzas/gastos/page.tsx` — filtro `vehiculo=<id>`, columna Vehículo, pasar listas al form.
- `src/app/(app)/contactos/[id]/page.tsx` — leftJoin `drivers` para mostrar nombre ?? texto histórico.
- **No tocar** `src/app/(app)/page.tsx` (Inicio, lo toca T-014) ni lo de clientes/potenciales (T-015).

### UI
- Sidebar: "Flota". Página: `PageHeader` "Flota" con descripción "Choferes, vehículos y costos por unidad".
- Sección "Vehículos": tabla Patente · Modelo · Plazas · Estado (badge Activo/Inactivo) · Recorridos · Facturado · Gasoil · Choferes · Gastos · Margen · acciones (Editar, Desactivar/Activar, Borrar con `ConfirmButton`). Botón "Nuevo vehículo".
- Sección "Choferes": Nombre · Teléfono · Estado · Recorridos · Pago al chofer · acciones. Botón "Nuevo chofer".
- `EmptyState` si no hay registros. Textos de toasts: "Vehículo guardado", "Chofer guardado", "Vehículo desactivado", etc.

## Plan
- [x] 1. Esquema en `schema.ts` (tablas + FKs + índices).
- [x] 2. Consultar (solo lectura) los textos históricos de `trip.driver` para armar el backfill.
- [x] 3. `npm run db:generate -- --name flota` (con migraciones de T-014/T-015 ya presentes si existen); agregar seed + backfill al SQL; `npm run db:migrate`; verificar conteos.
- [x] 4. `normalizePlate` + conceptos en `constants.ts` + test.
- [x] 5. `flota/actions.ts` y formularios; `flota/page.tsx` con estadísticas; ítem en sidebar.
- [x] 6. Ventas: actions, trip-form, page (joins, filtros, columna).
- [x] 7. Finanzas/Gastos: schema del gasto, fields, page (filtro y columna).
- [x] 8. Detalle de cliente: nombre del chofer por join.
- [x] 9. tsc, lint, test, build; pruebas manuales (solo a nivel base: unique de patente y restricción de borrado; la UI queda para probar a mano).

## Verificación
- `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build`
- Pruebas manuales (datos de prueba se crean y se **borran**, la base es producción):
  1. `/flota` lista 4 vehículos y 5 choferes seed.
  2. Crear vehículo "ZZ999ZZ" → cargar otro "zz 999 zz" → error de patente repetida (CA3).
  3. Crear recorrido de prueba con chofer y vehículo ZZ999ZZ → aparece en Ventas filtrando por ese vehículo y suma en la fila de ZZ999ZZ en `/flota`.
  4. Crear gasto "Seguro" asociado a ZZ999ZZ → suma en Gastos de la unidad y baja el margen.
  5. Intentar borrar ZZ999ZZ → mensaje CA4. Borrar recorrido y gasto de prueba; borrar el vehículo → OK.
  6. Editar un recorrido histórico sin match → el texto histórico se conserva.
  7. Usuario con `ventas=view`: ve `/flota` sin botones; sin `finanzas` no ve montos de costos.

## Fuera de alcance
- Liquidación/pagos a choferes (T-007).
- Vencimientos de documentación (VTV, seguro, licencia de conducir) y alertas.
- Kilometraje, consumo por vehículo y mantenimiento programado.
- Asignar vehículo a recorridos históricos (no hay dato).
- Nuevas categorías de gasto (se usa `concept` con sugerencias) y módulo de permisos propio "flota".
- Asociar `fuel_load` a vehículo.

## Preguntas abiertas
Respondidas por el usuario (2026-09-28):
- Hiace de 13: se tarifica con la categoría más baja ("8 pasajeros", que cubre 8 a 13), no con la de 14. Igual **el vehículo no ata la capacidad ni la tarifa** del recorrido (ver CA5b): por mantenimiento puede salir una unidad de 19 en un servicio de categoría 8.
- Permisos: sin módulo "Flota"; se usa `ventas`.
- Choferes históricos que no matchean: **no** se crean (ni inactivos); solo queda el texto en `trip.driver`.

---

## Notas de implementación
- **Migración** `drizzle/0003_flota.sql` (aditiva: 2 tablas, 4 columnas nullables, FKs restrict, 4 índices) + seed y backfill a mano. Aplicada en Neon. Se re-ejecutaron seed y backfill a mano para verificar idempotencia: 0 filas afectadas; quedan 4 vehículos, 5 choferes.
- **Backfill**: textos históricos eran solo nombres de pila (Jose 103, Walter 47, Ricardo 12, Omar 11, Sergio 9) → **182 recorridos** con `driver_id`. El SQL matchea genéricamente por nombre completo, primera o última palabra normalizada (solo claves que identifican a un único chofer), sin alias explícitos. **Sin `driver_id`** (quedan con texto): "Mingo" (19), "Walter y Omar" (1), "Sergio y Jose" (1); más 318 sin chofer. El backfill **no** borra `trip.driver` en los matcheados (dato histórico intacto); la UI muestra nombre del chofer ?? texto.
- **Desvío**: `ON DELETE RESTRICT` en Postgres dispara `23001` (restrict_violation), no `23503`; `flota/actions.ts` trata ambos códigos como "Tiene movimientos asociados…" (verificado contra la base con datos PRUEBA, ya borrados).
- `driver-form.tsx` / `vehicle-form.tsx` exportan `DriverFields` / `VehicleFields` (campos sin estado, como `finanzas/fields.tsx`) que van dentro de `FormDialog`; no hace falta `"use client"`.
- Activar/desactivar usa `ConfirmButton` con ícono `Power`. En `/flota`, sin `finanzas` view se ocultan las columnas Facturado/Gasoil/Choferes/Gastos/Margen de vehículos; el pago al chofer de la tabla de choferes se muestra siempre (ya es visible en Ventas con `ventas` view). Período por defecto: primer a último día del mes actual.
- CA5b: el select de vehículo no tiene lógica; `buildTrip` no lo usa para capacidad/tarifa/precio. El vehículo muestra "PATENTE · modelo (plazas)" (modelo completo, no abreviado).
- Gastos: el datalist de concepto sugiere `VEHICLE_EXPENSE_CONCEPTS` + conceptos ya usados. El filtro por vehículo aplica a la tabla de gastos (no a los totales por categoría ni a combustible).
- `revalidatePath("/flota")` agregado en las acciones de Ventas y Finanzas.
- Hallazgo revisión (a): el margen por vehículo en `/flota` ahora descuenta `trips.extraPayments` (igual que `ventas/page.tsx`); se suman a la columna "Gastos" (con tooltip "Gastos del vehículo + pagos adicionales de sus recorridos") para que las columnas cierren con el margen.
- Hallazgo revisión (b): `flota/actions.ts` tiene mensajes en español en todos los `.min(1)`/`.max()` de zod (nombre, modelo, patente).
- Archivos: `src/db/schema.ts`, `drizzle/0003_flota.sql` + `meta/0003_snapshot.json` + `_journal.json`, `src/lib/constants.ts`, `src/lib/constants.test.ts`, `src/app/(app)/flota/{page,actions,driver-form,vehicle-form}.tsx|ts`, `src/components/app-sidebar.tsx`, `src/app/(app)/ventas/{actions.ts,trip-form.tsx,page.tsx}`, `src/app/(app)/finanzas/{actions.ts,fields.tsx,gastos/page.tsx}`, `src/app/(app)/contactos/[id]/page.tsx`.
- **Arreglo posterior (Mingo)**: "Mingo" es Domingo Sículo (dueño). `drizzle/0006_chofer_domingo.sql` (custom) da de alta el chofer "Domingo Sículo" (idempotente, patrón de 0003) y completa `trip.driver_id` donde es NULL y el texto normalizado es "mingo", "domingo" o "domingo siculo", sin tocar `trip.driver`. Aplicada en Neon: **19 recorridos** asociados (id 6). "Walter y Omar" y "Sergio y Jose" quedan solo como texto.
- Verificación: `tsc`, `lint`, `test` (39 ok) y `build` pasan. `/flota` necesita un `build` (o `dev`) para que exista el tipo `PageProps<"/flota">`.

## Revisión
Veredicto: **APROBADO**
- Criterios: CA1–CA12 y CA5b ✅ (CA4 acepta 23001 y 23503). tsc y lint OK; test y build los corrió el implementador: 39/39 y OK.
- [MENOR] `flota/page.tsx:172`: el margen por vehículo no descuenta `trips.extraPayments` y el de Ventas sí.
- [MENOR] `flota/actions.ts:31,76`: `.min(1)`/`.max(200)` no tienen mensaje en español.
- [MENOR] `ventas/actions.ts:74`: al editar un recorrido completado por el backfill se borra `trip.driver`. Lo pide la spec y queda así.
- Verificado: permisos (Flota con ventas, montos con finanzas), migración aditiva con seed y backfill idempotentes, Inicio sin tocar.
