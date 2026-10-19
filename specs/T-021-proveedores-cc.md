# T-021 · Proveedores y cuenta corriente con proveedores

- Estado: Implementada
- Prioridad: Media
- Riesgo: Alto <!-- esquema + migración con backfill sobre producción + saldos -->
- Fecha: 2026-10-19
- Tarea: `specs/TAREAS.md` → T-021

## Contexto
Hoy el proveedor es texto libre (`expense.supplier`, `trip.fuel_supplier`, `fuel_load.supplier`) y solo las estaciones tienen un "saldo" calculado en la pestaña Combustible de Gastos. Se quiere una lista de proveedores y una cuenta corriente por proveedor (gastos a pagar − pagos). Base de T-022 (gastos nuevos), que agrega el formulario que usa `supplier_id` y "a pagar".

## Objetivo
ABM de proveedores en `/finanzas/proveedores` con saldo por proveedor, y detalle `/finanzas/proveedores/[id]` con movimientos y saldo corrido, donde se registran pagos. Las estaciones muestran el mismo saldo que la pestaña Combustible.

## Criterios de aceptación
- [x] CA1 Existe la tabla `supplier` (nombre único, CUIT, factura sí/no, rubro, activo, notas) y `supplier_payment`; `expense` tiene `supplier_id` (FK restrict, nullable) y `paid` (bool, default `true`).
- [x] CA2 Tras migrar existen **Axion Sarmiento** y **Shell Maza** (rubro "Combustible") más un proveedor por cada texto distinto de `expense.supplier`, `trip.fuel_supplier` y `fuel_load.supplier`; cada `expense` con `supplier` texto tiene su `supplier_id`. Correr el backfill dos veces no duplica nada.
- [x] CA3 `/finanzas/proveedores` lista proveedores (nombre, rubro, CUIT, factura sí/no, estado, saldo) con filtro por texto/rubro/activos; alta/edición en `FormDialog`, activar/desactivar y borrar (si tiene movimientos: "No se puede eliminar: tiene gastos o pagos; desactivalo").
- [x] CA4 Nombre duplicado (ignorando mayúsculas y espacios extremos) da "Ya existe un proveedor con ese nombre".
- [x] CA5 `/finanzas/proveedores/[id]` muestra movimientos ordenados con saldo corrido: gastos a pagar (debe), gastos contado (informativos, no mueven saldo), pagos (haber); para estaciones además gasoil de recorridos (agrupado por día) y cargas extras (debe), y los gastos de categoría combustible como pagos (haber).
- [x] CA6 Desde el detalle se registra, edita y borra un pago (fecha, monto, medio, observaciones) y el saldo se actualiza.
- [x] CA7 La pestaña Combustible de `/finanzas/gastos` suma los `supplier_payment` de cada estación en "Pagado"; su saldo por estación coincide con el del detalle del proveedor (sin filtro de fechas).
- [x] CA8 Inicio (T-016) y Flota (T-001) muestran los mismos números que antes: `supplier_payment` **no** es gasto en reportes.
- [x] CA9 Lógica de movimientos/saldo en función pura con tests Vitest (vacío, contado, a pagar, pagos, estación con gasoil y cargas, saldo anterior con `desde`).
- [x] CA10 Sidebar de Finanzas tiene "Proveedores"; todo requiere `finanzas` (ver) y las acciones `finanzas` (editar).

## Diseño
### Datos
- `supplier`: `id` identity, `name` text not null (único sobre `lower(trim(name))` o normalizado en la acción + `uniqueIndex` en `name`), `cuit` text, `invoices` bool not null default true ("Emite factura"), `category` text (rubro, con sugerencias), `active` bool default true, `notes`, `created_at`.
- `supplier_payment`: `id`, `supplier_id` FK `supplier` restrict not null, `date` date string, `amount` money not null, `method` text, `notes`, `created_at`; índice (`supplier_id`, `date`).
- `expense`: + `supplier_id` FK restrict nullable (índice) y `paid` bool not null default true. `expense.supplier` (texto) queda como histórico; no se borra.
- Migración (número: la siguiente libre **después** de las de T-018..T-020; nombre `proveedores`): DDL generado + backfill en el mismo SQL: `INSERT … ON CONFLICT DO NOTHING` de las 2 estaciones y de los `DISTINCT trim(...)` no vacíos de las 3 columnas de texto (rubro "Combustible" para los que vienen de `trip`/`fuel_load`); luego `UPDATE expense SET supplier_id = s.id FROM supplier s WHERE s.name = trim(expense.supplier) AND supplier_id IS NULL`. Sin `ALTER TYPE`, así que va en una sola migración.
- Regla de saldo: debe = gastos `paid=false` no combustible + (por nombre de estación) gasoil de `trip` + `fuel_load`; haber = `supplier_payment` + gastos combustible del proveedor. Las estaciones se vinculan **por nombre** (`trip.fuel_supplier = supplier.name`), sin FK nueva en `trip`/`fuel_load`.
### Permisos
Módulo `finanzas`: `view` para ver listado/detalle, `edit` para ABM y pagos.
### UI
- Listado: `PageHeader` "Proveedores" · "Lista de proveedores y saldo a pagar"; botón "Nuevo proveedor"; StatCard "Total a pagar". Badge "Factura" / "Sin factura".
- Detalle: nombre + datos, StatCards (Debe, Pagado, Saldo), filtro desde/hasta (con línea "Saldo anterior"), tabla Fecha · Tipo · Detalle · Debe · Haber · Saldo; botón "Registrar pago".

## Mapa de código
- `src/db/schema.ts` › después de `expenses` (~l.333–356) — agregar `suppliers`, `supplierPayments`; en `expenses` columnas `supplierId`, `paid` e índice `expense_supplier_idx`.
- `src/lib/constants.ts` — `SUPPLIER_CATEGORIES` (Combustible, Mecánica, Repuestos, Cubiertas, Seguros, Lavadero, Servicios, Estudio contable, Otros). `FUEL_SUPPLIERS` se mantiene (sugerencias del form de recorrido). Archivo compartido con T-018..T-020: solo agregar al final.
- Nuevo `src/lib/supplier-ledger.ts` (+ `.test.ts`) — patrón de `buildStatement` en `src/lib/statement.ts` (~l.33): entrada filas planas, salida líneas con saldo corrido desde `opening`.
- Nuevo `src/lib/suppliers.ts` (`server-only`) — `getSupplierBalances()` (saldo por proveedor para el listado) y `getSupplierStatement(id, desde?, hasta?)`; usar `sumOf` de `src/lib/balances.ts` (l.7).
- Nuevo `src/app/(app)/finanzas/proveedores/page.tsx` y `[id]/page.tsx` — imitar `src/app/(app)/finanzas/cuentas/[id]/page.tsx` (detalle) y `src/app/(app)/flota/page.tsx` (listado con `ToggleButton` ~l.276, activar/desactivar).
- `src/app/(app)/finanzas/actions.ts` — `saveSupplier`, `toggleSupplier`, `deleteSupplier`, `saveSupplierPayment`, `deleteSupplierPayment`; `revalidate()` (l.11) agregar `/finanzas/proveedores` (ya cubierto por layout `/finanzas`). Errores: `23505` duplicado; `23001`/`23503` en uso — copiar `pgCode`/`isInUse` de `src/app/(app)/flota/actions.ts` (l.19–20).
- `src/app/(app)/finanzas/fields.tsx` — `SupplierFormFields` y `SupplierPaymentFields` (reusar `PAYMENT_METHODS` l.22, patrón de `CollectionFields`).
- `src/app/(app)/finanzas/gastos/page.tsx` › query `fuelPayments` (~l.74–78) y armado `stations` (~l.95–110) — sumar `supplier_payment` por `supplier.name` al `paid` de la estación.
- `src/components/app-sidebar.tsx` (~l.44–46) — hijo `{ title: "Proveedores", href: "/finanzas/proveedores" }` (compartido con T-018..T-020: solo agregar la línea).
- No tocar: `src/lib/reports.ts` (Inicio) ni la query de gastos de `src/app/(app)/flota/page.tsx` (l.55–59).

## Plan
- [x] 1. Schema + constants; `npm run db:generate -- --name proveedores`; agregar backfill al SQL; `npm run db:migrate`; verificar conteos (proveedores creados, gastos con `supplier_id`).
- [x] 2. `supplier-ledger.ts` + tests.
- [x] 3. `suppliers.ts` (queries) y acciones.
- [x] 4. Listado y detalle; sidebar.
- [x] 5. Pestaña Combustible con pagos a proveedor.

## Verificación
- `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build`
- Manual: anotar saldos de la pestaña Combustible y totales de Inicio/Flota antes de migrar y comparar después. Crear proveedor "ZZ Prueba", pago de prueba en Axion Sarmiento (ver bajar saldo en detalle y en Combustible), borrar ambos. Probar nombre duplicado y borrar proveedor con gastos.

## Fuera de alcance
- Formulario de gastos con proveedor/a pagar (T-022). FK de `trip`/`fuel_load` a `supplier`. Aplicación de pagos a gastos puntuales (el pago baja el saldo general). PDF de cuenta del proveedor.

## Decisiones propuestas
- D1 Pagos a estaciones de ahora en más — **Por defecto:** se registran como `supplier_payment` desde el proveedor; los gastos combustible viejos siguen contando como pagos · Alternativa: seguir cargándolos como gasto categoría combustible.
  - ✅ Usuario: por defecto.
- D2 Gasoil de recorridos en el detalle de la estación — **Por defecto:** una línea por día ("Gasoil recorridos (n)") · Alternativa: una por recorrido o por mes.
  - ✅ Usuario: por defecto.
- D3 Gastos contado en la cuenta del proveedor — **Por defecto:** se muestran sin mover el saldo · Alternativa: no mostrarlos.
  - ✅ Usuario: por defecto.

## Preguntas bloqueantes
- Ninguna

---

## Notas de implementación
- Migración `drizzle/0009_proveedores.sql`: DDL generado + backfill (estaciones, `DISTINCT ON lower(trim)` de `trip.fuel_supplier`/`fuel_load.supplier`/gastos combustible con rubro Combustible, resto de `expense.supplier` sin rubro; `UPDATE expense … supplier_id IS NULL` por `lower(trim)`). Resultado en producción: 2 proveedores (Axion Sarmiento id 1, Shell Maza id 2; no había otros textos), 19/19 gastos con texto vinculados (24.763.131,37). Re-ejecutado el backfill: sin duplicados ni cambios. Totales de `expense` (90 · 72.387.945,38), gasoil de `trip` y `fuel_load` idénticos antes/después.
- Unicidad: `uniqueIndex("supplier_name_idx")` sobre `lower(name)` (expresión) + la acción guarda el nombre recortado y con espacios internos unificados; `23505` → "Ya existe un proveedor con ese nombre" (probado: `prueba zz` vs `PRUEBA ZZ` da 23505).
- Saldos verificados por script (`tsx --conditions=react-server`): Axion 9.911.285,13 y Shell −176.047,37, iguales a la fórmula de la pestaña Combustible antes de migrar; pago PRUEBA de 1.000 bajó Axion a 9.910.285,13 y al borrarlo volvió; borrar Axion da 23001. Datos PRUEBA borrados.
- Decisión extra: `saveExpense` (form actual) resuelve `supplier_id` por nombre del texto `supplier` (null si no existe) para que listado/detalle y pestaña Combustible no se desincronicen hasta T-022, que lo reemplaza por un selector.
- Pestaña Combustible: los gastos combustible se agrupan por `coalesce(supplier.name, expense.supplier)`; los `supplier_payment` se suman solo a estaciones (nombre ya presente en la tabla o rubro Combustible), con los mismos filtros de fecha. El texto al pie ahora remite a Proveedores.
- Vínculo estación ↔ recorridos/cargas por `lower(trim(nombre))` (sin FK); el campo nombre del form avisa que debe coincidir. Renombrar una estación corta ese vínculo (fuera de alcance).
- `isInUse` agregado a `src/lib/db-errors.ts` (flota/ventas siguen con su copia local, no se tocaron).
- Listado: filtro estado por defecto "Activos"; StatCard "Total a pagar" = suma de saldos positivos de lo listado. Detalle: sin `desde` muestra todo el historial (coincide con Combustible sin filtro).
- Archivos: `src/db/schema.ts`, `src/lib/{constants,db-errors,supplier-ledger(+test),suppliers}.ts`, `src/app/(app)/finanzas/{actions.ts,fields.tsx,gastos/page.tsx,proveedores/page.tsx,proveedores/[id]/page.tsx}`, `src/components/app-sidebar.tsx`, `drizzle/0009_proveedores.sql` (+ meta).
- No probado con clics en el navegador (páginas compilan en build; lógica probada por script y Vitest).

## Revisión
Veredicto: APROBADO
Criterios: CA1 ✅ · CA2 ✅ (migración idempotente, ON CONFLICT sobre lower(name)) · CA3 ✅ · CA4 ✅ · CA5 ✅ · CA6 ✅ · CA7 ✅ · CA8 ✅ (reports.ts y flota sin tocar) · CA9 ✅ · CA10 ✅. Sin prueba en navegador (declarado).
Hallazgos:
1. [MENOR] gastos/page.tsx:~125 — la pestaña Combustible compara el nombre de estación exacto (`stations.has(p.supplier)`, y agrupa `trips.fuelSupplier` crudo), mientras el detalle vincula por lower(trim) → si el texto de un recorrido difiere solo en mayúsculas/espacios del proveedor, aparecen dos filas y el saldo difiere entre ambas vistas. Hoy no ocurre (datos idénticos); normalizar clave si aparece.
2. [MENOR] actions.ts deleteSupplier — una estación con solo gasoil/cargas por texto (sin gastos ni pagos) se puede borrar y su historial deja de verse en la cuenta; no hay FK. Aceptable por decisión de diseño (vínculo por nombre).
3. [MENOR] saveExpense: el desvío de completar supplier_id por nombre es coherente con la pestaña Combustible y con el detalle; sin riesgo, T-022 lo reemplaza.
