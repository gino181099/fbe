# Registro

Una entrada por tarea terminada, **la más nueva arriba**. Formato fijo y breve (≤ 12 líneas por entrada):

```
## AAAA-MM-DD · T-XXX · Título
- Resultado: qué quedó funcionando (1–2 líneas)
- Archivos: rutas principales
- Datos: migraciones / cambios en la base (o "—")
- Verificación: tsc · lint · build · pruebas manuales hechas
- Revisión: hallazgos del revisor y cómo se resolvieron
- Pendiente: lo que quedó afuera o nuevas tareas sugeridas (IDs)
- Costo: spec Xk · impl Yk · rev Zk tokens · N min (lo completa el orquestador)
```

---

## 2026-10-19 · T-022 · Gastos nuevos (general o por vehículo, con comprobante)
- Resultado: gasto con alcance General/Vehículo, categorías vehiculo/personal/generales/combustible + subcategoría, qué/para qué, comprobante (tipo + N°), proveedor (select) y Contado/A pagar; listado con filtros alcance/proveedor/estado y StatCards + "A pagar"; Flota suma gastos de vehículo sin combustible con link a Gastos.
- Archivos: `src/lib/{constants,expense-rules(+test)}.ts`, `schema.ts`, `finanzas/{actions.ts,fields.tsx,gastos/page.tsx}`, `flota/page.tsx`, `scripts/migrate-legacy.ts`.
- Datos: `0010_gastos_nuevos` (enum recreado vía text + mapeo, `expense_scope`/`expense_voucher_type`, 5 columnas, backfill scope, CHECK). 90 gastos / $72.387.945,38 iguales; varios 71 → generales; serie de Inicio idéntica. PRUEBA creados y borrados.
- Verificación: tsc · lint · npm test 140/140 · build OK · script contra la base (validaciones, saldo proveedor a pagar/contado, CHECK 23514, query Flota). Sin clics en navegador.
- Revisión: APROBADO (0 bloqueantes, 0 importantes). Menores pendientes: el enlace de Flota a Gastos por vehículo también lista combustible (la columna lo excluye); el DROP TYPE de 0010 dependía de que nadie más usara el enum (ya aplicada, totales iguales).
- Pendiente: —
- Costo: spec ~39k (tanda T-021..T-022 78k) · impl 144k · rev 29k tokens · 11 min

## 2026-10-19 · T-021 · Proveedores y cuenta corriente con proveedores
- Resultado: `/finanzas/proveedores` (ABM, filtros texto/rubro/estado, saldo, total a pagar) y `/[id]` (movimientos con saldo corrido, desde/hasta con saldo anterior, registrar/editar/borrar pagos); estaciones suman gasoil por día + cargas extras; pestaña Combustible suma `supplier_payment`. Sidebar "Proveedores".
- Archivos: `src/lib/{supplier-ledger(+test),suppliers,db-errors,constants}.ts`, `schema.ts`, `finanzas/{actions,fields}.tsx?`, `finanzas/gastos/page.tsx`, `finanzas/proveedores/**`, `app-sidebar.tsx`.
- Datos: `0009_proveedores` (supplier, supplier_payment, expense.supplier_id/paid + backfill idempotente): 2 proveedores, 19 gastos vinculados; montos sin cambios; saldos Axion 9.911.285,13 / Shell −176.047,37 iguales antes/después. Datos PRUEBA creados por script y borrados.
- Verificación: tsc · lint · npm test 135/135 · build OK · script contra la base (saldos, pago, duplicado 23505, borrar en uso 23001). Sin clics en navegador.
- Revisión: APROBADO (0 bloqueantes, 0 importantes). Menores pendientes: Combustible compara nombres de estación exactos y el detalle usa lower(trim) (podrían divergir); una estación sin gastos ni pagos se puede borrar (sin FK desde trip/fuel_load); puente de `saveExpense` por nombre hasta T-022.
- Pendiente: T-022 (form de gastos con proveedor/a pagar); hasta entonces `saveExpense` vincula `supplier_id` por nombre.
- Costo: spec ~39k (tanda T-021..T-022 78k) · impl 138k · rev 32k tokens · 11 min

## 2026-10-19 · T-019 · Recibos numerados con PDF
- Resultado: `/finanzas/recibos` (listado, filtros, total, PDF, anular) y `/nuevo` (saldo, recorridos pendientes tildables, monto ≥ Σ tildados, excedente FIFO); recibo X 0001-NNNNNNNN correlativo; PDF con monto en letras; ledger/saldos/Inicio/reportes cuentan recibos vigentes; Cobros queda como historial de solo lectura; "Registrar recibo" en la cuenta corriente.
- Archivos: `src/lib/{amount-words,receipts,receipt-pdf}.ts(x)`, `ledger.ts` (+tests), `balances.ts`, `reports.ts`, `rates.ts`, `finanzas/recibos/**`, `api/recibo/[id]`, `finanzas/{cobros,cuentas/[id]}`, `(app)/page.tsx`, acciones de ventas/contactos, sidebar.
- Datos: `0008_recibos` (solo CREATE). "Cobrado" histórico por mes idéntico antes/después. Datos "PRUEBA T-019" creados por script y borrados.
- Verificación: tsc · lint · npm test 129/129 · build OK · script contra la base (tildado, FIFO, anulación, validaciones, 23001) · PDF anulado visto renderizado · páginas 200. Alta desde el navegador no clickeada.
- Revisión: APROBADO (0 bloqueantes, 0 importantes). Menores pendientes: si falla la compensación tras error en `receipt_trip` queda un recibo sin viajes (saldo coherente); altas simultáneas sobre el mismo viaje se resuelven por el tope del ledger; probar una vez el alta con clic real en producción.
- Pendiente: hallazgo T-017 resuelto en la acción (solo recorridos ≥ corte con pendiente); recibos simultáneos sin transacción (riesgo aceptado).
- Costo: spec ~35k (tanda T-018..T-020 105k) · impl 206k · rev 36k tokens · 16 min

## 2026-10-19 · T-018 · Pantallas de cuenta corriente y comprobantes + PDF de comprobante interno
- Resultado: `/finanzas/comprobantes` (filtros, totales, anular con motivo) y `/nuevo` (factura A/B/C, interno X numerado automático, ND/saldo inicial con ítems, NC/bonificación); cuenta del cliente con "Nuevo comprobante", factura/interno como líneas informativas, "Recorridos sin comprobante" y "Pendientes de cobro"; PDF `/api/comprobante/[id]` con logo y datos de la empresa; `updateTrip`/recálculo de tarifas respetan recorridos en comprobante vigente.
- Archivos: `src/lib/{doc-number,document-rules,documents,db-errors,company,pdf-brand,document-pdf}.ts(x)` (+tests), `finanzas/comprobantes/**`, `finanzas/cuentas/[id]/page.tsx`, `ledger.ts`, `balances.ts`, `constants.ts`, `ventas/actions.ts`, `rates.ts`, `app-sidebar.tsx`, `next.config.ts`.
- Datos: sin migración. Datos "PRUEBA T-018" (cliente 79, 3 recorridos, 5 comprobantes) creados desde la app y borrados.
- Verificación: tsc · lint · npm test 100/100 · build OK · navegador: factura (saldo igual, quedan sin comprobante), número repetido → error, interno X 0001-00000001 + PDF 200 (404 para factura), ND 2 ítems, NC, saldo inicial, anular factura (libera recorridos, tachado), cambio de precio de recorrido en interno → error.
- Revisión: APROBADO (0 bloqueantes, 0 importantes). Menores pendientes: `recalculateTripPrices` saltea en silencio recorridos con comprobante (informar cuántos); unicidad recorrido↔comprobante sin transacción (riesgo aceptado por la spec). PDF no visto renderizado; pesa ~760 KB por el logo.
- Pendiente: PDF pesa ~760 KB por el logo PNG (convendría una versión liviana); no se vio el PDF renderizado (solo status/tamaño); NC con relacionado no probada en UI.
- Costo: spec ~35k (tanda T-018..T-020 105k) · impl 227k · rev 36k tokens · 21 min

## 2026-10-19 · T-017 · Cuenta corriente con comprobantes: modelo, corte y saldo inicial
- Resultado: tablas `document`/`document_item` (anular = `voided_at`, D4 alternativa) y `client.payment_days`; ledger puro con corte 19/10/2026, FIFO y vencimientos; saldos, estado de cuenta y PDF calculados desde el corte. Borrar recorrido en comprobante / cliente con comprobantes da error legible.
- Archivos: `src/lib/ledger.ts` (+test), `src/lib/balances.ts`, `src/lib/constants.ts`, `src/db/schema.ts`, `src/lib/statement.ts`, `finanzas/cuentas/[id]/page.tsx`, `statement-pdf.tsx`, acciones de ventas y contactos.
- Datos: `0007_cuenta_corriente` aplicada (solo CREATE + ADD COLUMN default 30). Serie mensual de Inicio idéntica antes/después. Datos PRUEBA creados y borrados.
- Verificación: tsc · lint · npm test 83/83 · build OK · prueba por script contra la base (saldo 2300 esperado, 23001 al borrar). No se probó en el navegador.
- Revisión: APROBADO (0 bloqueantes, 0 importantes). Menores pendientes: espacio en `EXPENSE_CATEGORIES =[`; `ledger.ts:357` ignora sin aviso asignación explícita a recorrido pre-corte (documentar en T-019); regla de corte duplicada en SQL (`balances.ts`) y JS (`ledger.ts`).
- Pendiente: pantallas y acciones de comprobantes (T-018), recibos (T-019), mora (T-020).
- Costo: spec 55k · impl 116k · rev 35k tokens · 13 min

## 2026-09-28 · T-016 · Gráficos e informes de Inicio: gastos correctos + filtros
- Resultado: en Inicio, Gastos = costos directos de los recorridos (chofer + gasoil + adicionales, igual que /ventas) + gastos generales (gastos sin combustible + cargas extras). Margen = facturado − gastos. Filtros desde/hasta (máx. 36 meses) y cliente para la evolución mensual y los recorridos más vendidos.
- Archivos: `src/lib/monthly.ts` (+test), `src/lib/reports.ts`, `src/app/(app)/page.tsx`.
- Datos: — (causa confirmada con consulta de solo lectura: en 2026 no hay filas en `expense` ni en `fuel_load`; en ene 2026 los costos directos son $5.823.881,25 y Inicio mostraba $0).
- Verificación: npm test 65/65 · tsc · lint · build OK. No se probó en el navegador.
- Revisión: APROBADO (Sonnet), 2 menores sin corregir: el margen es bruto sin `finanzas` y neto con `finanzas`, y con `?cliente=` de un potencial no se muestra el nombre.
- Pendiente: —
- Costo: spec 41k · impl 89k (42 herramientas) · rev 30k tokens · ~7 min

## 2026-09-28 · T-015 · Tratamiento Clientes Potenciales
- Resultado: etapas de potenciales con nota automática en cada cambio. Ganado pasa a recurrente o especial y Perdido a inactivo. Cada contacto tiene una pestaña Seguimiento: las notas manuales las borra solo su autor y las automáticas no se borran. En Ventas no se pueden elegir potenciales.
- Archivos: `src/db/schema.ts`, `src/lib/prospects.ts` (+test), `contactos/**`, `ventas/{actions,trip-form}`, `components/badges.tsx`, `scripts/import-potenciales.ts` (`npm run db:import-potenciales [--aplicar]`).
- Datos: migraciones `0004` y `0005` (tipo `potencial` en el enum, tabla `client_note`) aplicadas en producción. Importación: 29 clientes y 29 notas, 1 omitido (Impulsa Mendoza). La segunda corrida no creó nada.
- Verificación: npm test 54/54 · tsc · lint · build OK; en la base se probó el borrado en cascada de las notas. No se probó en el navegador.
- Revisión: APROBADO; 4 menores sin corregir. El que importa: se puede pasar a Potencial un cliente que ya tiene recorridos, y eso le bloquea editarlos. Además se corrigieron los 2 menores de T-001.
- Pendiente: — (corregido después: el servidor rechaza pasar a Potencial a un cliente con recorridos; las tarifas no bloquean. Tests 55/55).

## 2026-09-28 · T-001 · Choferes y vehículos como entidades
- Resultado: `/flota` (permiso ventas; montos solo con finanzas) con el ABM de choferes y vehículos (patente única; si tienen movimientos no se borran, se desactivan) y un resumen por vehículo y por chofer. Recorridos y gastos tienen select de chofer y vehículo, y Ventas y Gastos filtran por ellos. El vehículo no afecta la tarifa.
- Archivos: `src/db/schema.ts`, `src/app/(app)/flota/*`, ventas y finanzas (actions/forms/pages), `app-sidebar.tsx`, `constants.ts` (+test).
- Datos: migración `0003_flota` (aditiva) aplicada en producción: 4 vehículos y 5 choferes. Backfill: 182 recorridos con `driver_id`; 21 sin asociar ("Mingo" 19, 2 con dos choferes) conservan el texto.
- Verificación: npm test 39/39 · tsc · lint · build OK; en la base se probaron la patente única y el bloqueo de borrado. No se probó en el navegador.
- Revisión: APROBADO; 3 menores. Pendientes de corregir: el margen de Flota no descuenta los adicionales y faltan mensajes de zod en español. El borrado de `trip.driver` al editar queda así, como pide la spec.
- Pendiente: — (los 2 menores se corrigieron junto con T-015. Migración `0006_chofer_domingo`: alta del chofer Domingo Sículo, "Mingo", y 19 recorridos asociados).

## 2026-09-28 · T-014 · Resumen mensual con gráficos en Inicio
- Resultado: Inicio muestra los últimos 12 meses (facturado, cobrado solo `kind='cobro'`, gastos y margen = facturado − gastos) en barras HTML/CSS y una tabla con total, más el top 10 de recorridos por cantidad. Cada sección se muestra según los permisos de ventas y finanzas.
- Archivos: `src/lib/monthly.ts` (+test), `src/lib/reports.ts`, `src/components/monthly-chart.tsx`, `src/app/(app)/page.tsx`.
- Datos: —
- Verificación: npm test 37/37 · tsc · lint · build OK; consultas de solo lectura contra Neon coherentes (Alta Montaña 74, Bodegas 67). No se probó en el navegador.
- Revisión: APROBADO; 2 menores sin corregir (key repetible en el ranking, agrupamiento por nombre de ruta).
- Pendiente: probar en `/` que el mes actual coincida con las tarjetas y revisar la vista con un usuario que tenga solo ventas.

## 2026-09-28 · T-013 · Saldo inicial y ajustes en cuentas corrientes
- Resultado: cobros con tipo `cobro`/`ajuste`; los ajustes bajan el saldo pero no suman a "Cobrado" (Inicio, cuentas, estado de cuenta, PDF, listado con filtro por tipo). Script `db:saldar-historico` (simula por defecto, idempotente) para saldar mes a mes.
- Archivos: `src/db/schema.ts`, `src/lib/{statement,balances,constants,statement-pdf}`, `src/app/(app)/page.tsx`, `src/app/(app)/finanzas/**`, `scripts/saldar-historico.ts`, `package.json`.
- Datos: migración `0002_collection_kind` (aditiva) aplicada en producción. Por decisión del usuario se saldaron **todos** los clientes: `--hasta 2026-08 --todos-legacy --aplicar` → 29 ajustes, $198.588.500 (Conocer $181,87M, Particular $13,06M, Impulsa Mendoza $1,4M, otros 5). Re-ejecución: 0 cambios (también con `--hasta 2026-12`).
- Verificación: npm test 30/30 · tsc · lint · build OK; simulación Viajes Conocer hasta 08/2026: $181.871.000, 16 ajustes (todos los legacy: $198.588.500, 29).
- Revisión: APROBADO; 3 menores corregidos (doble conteo en el script, totales separados en Cobros, mensaje neutro al borrar).
- Pendiente: —

## 2026-09-28 · T-012 · Tests automáticos de la lógica crítica
- Resultado: `npm test` (Vitest) corre 27 tests sin `.env.local` ni Neon. Lógica pura extraída: `planRateChanges` y `buildStatement`; `applyNewRates`/`getStatement` mantienen la firma.
- Archivos: `vitest.config.mts`, `src/lib/rates-plan.ts`, `src/lib/statement.ts`, `src/lib/rates.ts`, `src/lib/balances.ts`, `src/lib/*.test.ts`, `package.json`, `CLAUDE.md`.
- Datos: —
- Verificación: npm test 27/27 · tsc · lint · build OK.
- Revisión: APROBADO sin hallazgos; batch agrupado de `applyNewRates` verificado equivalente.
- Pendiente: prueba manual del estado de cuenta/PDF de Viajes Conocer (no-regresión).

## 2026-09-28 · T-011 · Solución de errores (estado de cuenta de Impulsa Mendoza)
- Resultado: rutas dinámicas (`/finanzas/cuentas/[id]`, `/contactos/[id]`, PDF) vuelven a andar. Causa: el `npm run dev` previo perdió su terminal y el worker de static paths moría con EPIPE; se reinició el server y se borró `.next`. Sin cambios en la app.
- Archivos: `scripts/migrate-legacy.ts` (mapeo Impulsar → Impulsa Mendoza), `specs/MEMORIA.md`.
- Datos: `client` id 8 renombrado a "Impulsa Mendoza" (mismo saldo $1.400.000).
- Verificación: tsc · lint · build OK; recorridas todas las páginas principales en dev y `npm start`, PDFs 8 y 1.
- Revisión: APROBADO; menores: `/login` sin sesión sin probar; el detalle del recorrido sigue diciendo "Impulsar" (texto importado).
- Pendiente: —

## 2026-09-28 · T-000 · Primera versión del ERP (CRM)
- Resultado: Contactos (tarifarios versionados + carga Excel/CSV), Ventas (precio automático), Finanzas (cuentas corrientes, cobros, gastos, combustible por estación, PDF), Usuarios (permisos por módulo), login Google + admin local.
- Archivos: `src/db/schema.ts`, `src/lib/*`, `src/app/(app)/**`, `src/app/(auth)/**`, `src/proxy.ts`, `scripts/*`.
- Datos: migraciones `0000_init`, `0001_fuel_supplier` (con backfill de proveedores). Importados 521 recorridos, 37 tarifas, 90 gastos, 32 cargas.
- Verificación: tsc, lint y build OK; prueba end-to-end en navegador (login, tarifario + recálculo, recorrido, cobro, PDF, permisos con usuario limitado).
- Revisión: bugs corregidos en pruebas — "50.000" se guardaba como 50; loop de redirección con sesión de usuario borrado; tabla de permisos mostraba valores viejos.
- Pendiente: T-001 a T-010 recomendadas; acciones manuales en `TAREAS.md`.
