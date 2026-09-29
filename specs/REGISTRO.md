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
