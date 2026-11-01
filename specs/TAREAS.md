# Tareas

Backlog del ERP. Agregá tareas en "Pendientes" (título + descripción) y pedíselas a Claude directamente en la sesión.
> El arnés `/tareas` está desactivado desde el 2026-10-20 (archivos en `.claude/_desactivado/`).

Estados: `Nueva` → `Especificada` → `Aprobada` → `En curso` → `Hecha` · también `Bloqueada` (con motivo).
Prioridad: `Alta` · `Media` · `Baja`.

**Próximo ID: T-033**

---

## 📥 Pendientes

> Rediseño de Finanzas (T-017…T-022), acordado el 2026-10-19. Plan completo: `C:\Users\ginof\.claude\plans\vamos-a-hacer-algunos-buzzing-diffie.md`. Hacerlas en orden.

### T-020 · Vencimientos y semáforo de mora
- Estado: Especificada
- Prioridad: Media
- Spec: specs/T-020-vencimientos-semaforo.md
- Descripción: El vencimiento es el del comprobante que incluye al débito o, si no tiene, la fecha + `payment_days` del cliente. Semáforo: al día / verde ≤30 días de atraso / amarillo ≤60 / rojo >60. Se muestra en el listado de cuentas corrientes (saldo, vencido, filtro por mora), en el estado de cuenta y en su PDF.
---

## 💡 Recomendadas por Claude (No implementar)

### T-004 · Cargas de combustible duplicadas (datos viejos)
- Estado: Recomendada
- Prioridad: Media
- Spec: —
- Descripción: En `Cargas_Extras` hay filas marcadas "Valor repetido, no dar bola" que hoy suman al consumo de Axion Sarmiento. Poder marcar una carga como "anulada" (excluida de los totales sin borrarla) y aplicarlo a esas filas.

### T-005 · Exportar listados a Excel
- Estado: Recomendada
- Prioridad: Media
- Spec: —
- Descripción: Botón "Exportar" en Ventas, Cobros, Gastos y Cuentas corrientes que descargue un .xlsx con los filtros aplicados.


### T-007 · Liquidación de choferes
- Estado: Recomendada
- Prioridad: Media
- Spec: —
- Descripción: Resumen por chofer y período con recorridos, pago por recorrido y adicionales; registrar el pago como gasto de categoría "Sueldos".

### T-008 · Envío del estado de cuenta por email
- Estado: Recomendada
- Prioridad: Baja
- Spec: —
- Descripción: Mandar el PDF al email del cliente desde la app (ej. con Resend), con registro de envíos.
---

## 🔧 Acciones manuales del equipo (fuera del código)

- [x] Repo privado en Bitbucket: `https://bitbucket.org/gfs181099/frabel-erp`, rama `main` (2026-10-25).
- [ ] Crear el proyecto en Vercel desde Bitbucket y cargar `DATABASE_URL`, `ACCESS_PASSWORD`, `AUTH_SECRET` (valores en `.env.local`).
- [ ] Cargar el tarifario de Huentata y marcar "recalcular" (2 viajes con precio $0).
- [ ] Revisar el viaje City Tours de 8 plazas del 03/04/2026 (no existe esa tarifa).
- [ ] Responder: ¿Shell Maza es cuenta corriente o pago en el momento?

---

## ✅ Hechas

### T-032 · Arreglo: "el volcado es de una versión más nueva" entre PCs
- Estado: Hecha (2026-10-25)
- Descripción: restore/inicializar comparaban la migración por hash, que cambia con los finales de línea del .sql (autocrlf); ahora comparan por fecha.

### T-031 · Descargar copia de la base
- Estado: Hecha (2026-10-25)
- Descripción: botón en el menú (solo `gino`) que baja la base completa en el formato de los backups, para guardarla en otra PC y cargarla con `db:restore`.

### T-030 · Diseño moderno (estilo Kanakku) y modo oscuro
- Estado: Hecha (2026-10-25)
- Descripción: paleta violeta, letra Instrument Sans, tarjetas blancas sobre fondo gris, tablas y estados nuevos, menú agrupado y comprimible, modo claro/oscuro.

### T-029 · Ayuda (i) en cada módulo
- Estado: Hecha (2026-10-25)
- Descripción: botón (i) junto al título de cada página; panel con para qué sirve el módulo y glosario. Textos en `src/lib/help.ts`.

### T-027 · Actividades de hoy en el Inicio
- Estado: Hecha (2026-10-25)
- Descripción: sección "Tus actividades de hoy" (vencidas + hoy del usuario) arriba del tablero.

### T-026 · Calendario de la agenda y actividades por vehículo
- Estado: Hecha (2026-10-25)
- Descripción: calendario mensual con colores de Odoo y arrastrar para reprogramar; ficha de vehículo con actividades y gastos.

### T-025 · Usuarios, agenda de actividades y auditoría (incluye T-006)
- Estado: Hecha (2026-10-25)
- Descripción: 4 usuarios (Gino, Gianella, Ale, Mingo) con la clave única; `/agenda` estilo Odoo (asignar a otro, hecha + programar la siguiente, reprogramar, contador en el menú, panel en contacto/oportunidad/proveedor); "creado/modificado por" en los registros principales.

### T-023 · Leads (CRM de oportunidades), notas y velocidad
- Estado: Hecha (2026-10-20)
- Plan: `C:\Users\ginof\.claude\plans\bueno-ahora-que-lo-spicy-yeti.md`
- Descripción: Sección `/leads` con Kanban (Nuevo/Contacto/Propuesta/Ganado/Perdido) y lista, permiso propio; los 29 potenciales pasaron a leads y salieron de Contactos. Notas unificadas ("Agregar nota") en contactos y leads. Esqueleto de carga, una consulta menos por página y región `gru1` para Vercel.

### T-022 · Gastos nuevos (general o por vehículo, con comprobante)
- Estado: Hecha (2026-10-19)
- Spec: specs/T-022-gastos-nuevos.md
- Descripción: Gasto con proveedor de la lista, alcance general/vehículo, categorías vehiculo/personal/generales/combustible + subcategoría, qué/para qué, comprobante y contado/a pagar. "Varios" pasó a "Generales" sin cambiar montos; Flota suma gastos por vehículo.

### T-021 · Proveedores y cuenta corriente con proveedores
- Estado: Hecha (2026-10-19)
- Spec: specs/T-021-proveedores-cc.md
- Descripción: `/finanzas/proveedores` (ABM y cuenta corriente con pagos). Backfill de Axion Sarmiento y Shell Maza; saldos de estaciones sin cambios.

### T-019 · Recibos numerados con PDF
- Estado: Hecha (2026-10-19)
- Spec: specs/T-019-recibos-numerados.md
- Descripción: `/finanzas/recibos` con numeración X 0001-…, viajes tildados o monto libre (FIFO), anulación y PDF con monto en letras. Cobros queda como historial de solo lectura.

### T-018 · Pantallas de cuenta corriente y comprobantes + PDF de comprobante interno
- Estado: Hecha (2026-10-19)
- Spec: specs/T-018-cc-pantallas-comprobantes.md
- Descripción: `/finanzas/comprobantes` (listado, alta desde recorridos sin comprobante, anulación), ND/NC/bonificación/saldo inicial con ítems y PDF del comprobante interno con logo y numeración automática.

### T-017 · Cuenta corriente con comprobantes: modelo, corte y saldo inicial
- Estado: Hecha (2026-10-19)
- Spec: specs/T-017-cc-comprobantes-modelo.md
- Descripción: Tablas `document`/`document_item` (anular = `voided_at`) y `client.payment_days`; ledger puro con corte 19/10/2026 y FIFO; saldos, estado de cuenta y PDF calculados desde el corte.

### T-016 · Gráficos e informes de Inicio
- Estado: Hecha (2026-09-28)
- Spec: specs/T-016-inicio-graficos-filtros.md
- Descripción: Gastos ahora incluye los costos de los recorridos (antes daba $0 en 2026) más los gastos generales. Se agregaron filtros desde/hasta y por cliente.

### T-015 · Tratamiento Clientes Potenciales
- Estado: Hecha (2026-09-28)
- Spec: specs/T-015-clientes-potenciales.md
- Descripción: Los potenciales tienen etapas (Sin contactar, Contactado, Ganado, Perdido). Al ganarse pasan a recurrente o especial, y al perderse quedan inactivos. Cada contacto tiene una pestaña de seguimiento con notas. Se importaron 29 prospectos (Impulsa Mendoza se omitió porque ya era cliente).

### T-001 · Choferes y vehículos como entidades
- Estado: Hecha (2026-09-28)
- Spec: specs/T-001-choferes-vehiculos.md
- Descripción: Pantalla Flota (`/flota`) con el ABM de choferes y vehículos y un resumen de costos y margen por vehículo y por chofer. Recorridos y gastos se asocian a un chofer y un vehículo. El vehículo no define la tarifa.

### T-014 · Resumen mensual con gráficos en Inicio
- Estado: Hecha (2026-09-28)
- Spec: specs/T-014-resumen-mensual.md
- Descripción: Inicio muestra los últimos 12 meses (facturado, cobrado, gastos y margen) en un gráfico y una tabla, y el top 10 de recorridos por cantidad.

### T-013 · Saldo inicial y ajustes en cuentas corrientes
- Estado: Hecha (2026-09-28)
- Spec: specs/T-013-saldo-historico.md
- Descripción: Movimientos tipo "ajuste" (no suman a Cobrado) + script idempotente que salda la deuda histórica mes a mes. Aplicado a **todos** los clientes (el usuario confirmó que pagaron todo): 29 ajustes, $198.588.500; ningún cliente queda con deuda.

### T-012 · Tests automáticos de la lógica crítica
- Estado: Hecha (2026-09-28)
- Spec: specs/T-012-tests-vitest.md
- Descripción: Vitest (`npm test`) con 27 tests de `parseAmount`, `formatMoney`, versionado de tarifas y estado de cuenta, sin tocar la base.

### T-011 · Solución de errores (estado de cuenta de Impulsa Mendoza)
- Estado: Hecha (2026-09-28)
- Spec: specs/T-011-error-estado-cuenta.md
- Descripción: Error "Jest worker encountered 2 child process exceptions" en rutas `[id]` (dev server sin terminal → EPIPE); cliente renombrado a "Impulsa Mendoza".

### T-000 · Primera versión del ERP (CRM)
- Estado: Hecha (2026-09-28)
- Descripción: Contactos, Ventas, Finanzas, Usuarios, login, importación de la base SQLite. Ver `specs/REGISTRO.md`.
