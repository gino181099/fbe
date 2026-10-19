# T-018 · Pantallas de cuenta corriente y comprobantes + PDF de comprobante interno

- Estado: Implementada
- Prioridad: Alta
- Riesgo: Alto (crea movimientos que cambian saldos: ND/NC/bonificación/saldo inicial; restringe edición de recorridos y recálculo de precios)
- Fecha: 2026-10-19
- Tarea: `specs/TAREAS.md` → T-018 · Base: `specs/T-017-cc-comprobantes-modelo.md` · Plan: `C:\Users\ginof\.claude\plans\vamos-a-hacer-algunos-buzzing-diffie.md`

## Contexto
T-017 dejó `document`/`document_item` (con `voided_at`), `CC_START` y `src/lib/ledger.ts`, pero los comprobantes solo se pueden cargar por SQL. Esta tarea agrega las pantallas y acciones para registrarlos y anularlos, y el PDF del comprobante interno (lo no facturado en ARCA).

## Objetivo
Desde la cuenta corriente de un cliente o desde `/finanzas/comprobantes`, el usuario registra facturas (hechas en ARCA), emite comprobantes internos numerados con PDF, carga ND/NC/bonificaciones y saldos iniciales con ítems, ve qué recorridos no tienen comprobante y qué débitos siguen sin cancelar, y anula comprobantes.

## Criterios de aceptación
- [ ] CA1 `/finanzas/comprobantes` lista comprobantes (fecha, tipo, número, cliente, vencimiento, monto, estado Vigente/Anulado) con filtros GET tipo, cliente, desde/hasta y estado (vigentes por defecto); totales por tipo en el pie. Sidebar: ítem "Comprobantes".
- [ ] CA2 `/finanzas/comprobantes/nuevo?cliente=&tipo=&desde=&hasta=`: elegir cliente + tipo + período lista los recorridos del cliente con fecha ≥ `CC_START` sin comprobante factura/interno vigente; tildarlos calcula el total en vivo.
- [ ] CA3 Factura: letra A/B/C, punto de venta (1–99999), número (1–99999999), fecha, vencimiento (por defecto fecha + `client.payment_days`), solo recorridos tildados (≥1). Número repetido (mismo tipo/letra/pv/número) → error legible.
- [ ] CA4 Comprobante interno: letra X, pv 1 y número automático = máximo de `interno` + 1 (incluye anulados, nunca se reutiliza), arranca en 1; ante choque del índice único (23505) se reintenta una vez. Solo recorridos tildados (≥1).
- [ ] CA5 ND y saldo inicial: ítems libres (fecha, detalle, monto > 0, ≥1 ítem); NC y bonificación: un monto > 0 + concepto, y para NC/ND comprobante relacionado opcional (del mismo cliente). `document.amount` = Σ ítems en todos los tipos.
- [ ] CA6 Validaciones en la acción: los recorridos son del cliente, ≥ `CC_START` y no están en otro factura/interno vigente; fecha válida; tipo/letra coherentes (factura A/B/C, interno X; ND/NC con letra opcional A/B/C/X y número opcional; bonificación/saldo inicial sin número).
- [ ] CA7 Anular (FormDialog con motivo opcional) setea `voided_at`/`voided_reason`; el anulado deja de contar en el saldo, sus recorridos vuelven a "sin comprobante" y se muestra tachado con badge "Anulado". No hay editar ni borrar comprobantes.
- [ ] CA8 `/finanzas/cuentas/[id]`: botones "Nuevo comprobante" (menú por tipo → `/finanzas/comprobantes/nuevo?cliente=<id>&tipo=…`); secciones "Recorridos sin comprobante" (con total) y "Pendientes de cobro" (débitos del ledger con `status ≠ cancelado`: fecha, detalle, vence, pagado, pendiente); el estado de cuenta muestra factura/interno como líneas informativas sin importe (cumple T-017 D7).
- [ ] CA9 `GET /api/comprobante/[id]` (finanzas view, 403 sin permiso, 404 si no existe o no es `interno`) devuelve el PDF: logo, datos de la empresa (MEMORIA "Empresa (para PDFs)"), "Comprobante interno X 0001-00000001", "Documento no válido como factura", fecha, vencimiento, cliente (nombre, CUIT, dirección), ítems y total; si está anulado, leyenda "ANULADO".
- [ ] CA10 `updateTrip` rechaza cambiar precio, cliente o fecha de un recorrido incluido en un factura/interno vigente ("Está en el comprobante X 0001-00000003: anulalo primero"); `recalculateTripPrices` no toca esos recorridos.
- [ ] CA11 Tests Vitest: `formatDocNumber` y las reglas puras de validación de comprobantes (por tipo, Σ ítems, montos > 0, letra/número).
- [ ] CA12 Acciones con `checkPermission("finanzas")` + nivel edit, `revalidatePath` de `/finanzas` (layout), `/contactos` (layout) y `/`; botones ocultos sin `can(user,"finanzas","edit")`.

## Diseño
### Datos
Sin cambios de esquema ni migración (todo lo crea 0007 de T-017). Alta: insert `document` con `.returning({ id })` y luego `document_item`; si falla el segundo insert, borrar el documento (cascade). La unicidad recorrido↔comprobante vigente se valida en la acción (riesgo de carrera aceptado: un solo operador).
### Permisos
`finanzas` view: listados, cuenta y PDF. `finanzas` edit: alta y anulación. `updateTrip` sigue con `ventas`.
### UI
- `/finanzas/comprobantes`: PageHeader "Comprobantes" + botón "Nuevo comprobante"; acciones por fila: PDF (solo interno), Anular.
- `/finanzas/comprobantes/nuevo`: form GET (cliente, tipo, desde, hasta) arriba; abajo componente cliente con checkboxes de recorridos (fecha, recorrido, capacidad, pax, precio), filas de ítems libres agregables (ND/saldo inicial), campos del encabezado según tipo, total y "Guardar". Al guardar: toast y `router.push` a `/finanzas/cuentas/<cliente>`.
- Número mostrado siempre como `X 0001-00000001` (letra, pv 4 dígitos, número 8 dígitos).

## Mapa de código
- `src/lib/doc-number.ts` nuevo (puro): `formatDocNumber(letter, pos, number)`; lo reutiliza T-019. Test `doc-number.test.ts`.
- `src/lib/document-rules.ts` nuevo (puro): validación por tipo (qué campos, trips vs ítems libres, Σ) usada por la acción. Test `document-rules.test.ts`. Imitar `src/lib/rates-plan.ts` + su test.
- `src/lib/documents.ts` nuevo (`server-only`): `listDocuments(filtros)`, `getDocument(id)` (con ítems + cliente), `getUninvoicedTrips(clientId, desde, hasta)` (trips ≥ `CC_START` sin ítem en documento factura/interno con `voided_at is null`; join `routes` como `getStatement` en `src/lib/balances.ts`), `nextInternalNumber()`, `tripsInActiveDocument(tripIds)`.
- `src/app/(app)/finanzas/comprobantes/actions.ts` nuevo: `createDocument(input)` con objeto tipado (no FormData) como `saveRateVersion` en `src/app/(app)/contactos/actions.ts` (~165-219); `voidDocument(id, formData)`. Reutilizar `isUniqueViolation` de `contactos/actions.ts` (~37) — moverlo a `src/lib/forms.ts` o `src/lib/db-errors.ts` y usarlo en ambos.
- `src/app/(app)/finanzas/comprobantes/page.tsx` nuevo: patrón de filtros/tabla/pie de `src/app/(app)/finanzas/cobros/page.tsx`.
- `src/app/(app)/finanzas/comprobantes/nuevo/page.tsx` + `document-form.tsx` ("use client", tipos con `import type`; etiquetas desde `DOCUMENT_TYPE_LABELS` de `src/lib/constants.ts`). Patrón de diálogo con estado: `src/app/(app)/contactos/[id]/rate-version-dialog.tsx`.
- `src/app/(app)/finanzas/cuentas/[id]/page.tsx`: acciones del header (~52-73), secciones nuevas después de la tabla (~141); badge de líneas informativas con `MOVEMENT_KIND_LABELS`.
- `src/lib/ledger.ts` (de T-017): líneas informativas `kind: "factura" | "interno"` (debit = credit = 0, no cambian saldo) y exponer en cada débito su origen (`tripId` / `documentId`) si no lo hace; sumar casos a `ledger.test.ts`. `src/lib/constants.ts`: agregar `factura`/`interno` a `MOVEMENT_KINDS`/`MOVEMENT_KIND_LABELS`.
- `src/lib/balances.ts` › `getStatement`: pasar al ledger los factura/interno vigentes como informativos; filtrar `voided_at is null` en todas las consultas de documentos (también `getBalances`).
- `src/lib/company.ts` nuevo: datos de la empresa (razón social, CUIT, condición IVA, domicilio, teléfonos, email). `src/lib/pdf-brand.tsx` nuevo: encabezado común react-pdf con `Image` del logo (`public/brand/frabel-logo.png` leído con `fs` desde `process.cwd()`) y datos de la empresa; lo reutilizan T-019 y T-020. En `next.config.ts` agregar `outputFileTracingIncludes` para `/api/**` → `./public/brand/**` (doc: `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`).
- `src/lib/document-pdf.tsx` + `src/app/api/comprobante/[id]/route.tsx`: imitar `src/lib/statement-pdf.tsx` y `src/app/api/estado-cuenta/[clientId]/route.tsx` (permiso, `renderToBuffer`, headers). Nombre: `comprobante-X-0001-00000001.pdf`.
- `src/app/(app)/ventas/actions.ts` › `updateTrip` (~105): antes del update, si el recorrido está en factura/interno vigente y cambian `price`/`clientId`/`date` → error. `src/lib/rates.ts` › `recalculateTripPrices` (~69): agregar `AND NOT EXISTS (select 1 from document_item di join document d on d.id = di.document_id where di.trip_id = t.id and d.voided_at is null and d.type in ('factura','interno'))`.
- `src/components/app-sidebar.tsx` › `NAV` Finanzas children (~43): agregar "Comprobantes" (`/finanzas/comprobantes`). T-021/T-022 agregan Proveedores aquí: no reordenar el resto.
- Trampa: `PageProps<"/finanzas/comprobantes/nuevo">` no tipa hasta correr `dev`/`build`.

## Plan
- [x] 1. `doc-number.ts`, `document-rules.ts` + tests; ajuste de `ledger.ts`/constants + tests.
- [x] 2. `documents.ts`, acciones (alta/anulación), `isUniqueViolation` compartido.
- [x] 3. Páginas `/finanzas/comprobantes` y `/nuevo` + sidebar.
- [x] 4. Secciones y botones en `/finanzas/cuentas/[id]`; filtro `voided_at` en `balances.ts`.
- [x] 5. `company.ts`, `pdf-brand.tsx`, PDF de comprobante interno + `next.config.ts`.
- [x] 6. Restricciones en `updateTrip` y `recalculateTripPrices`.

## Verificación
- `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build` (una vez, al final)
- Manual (cliente "Prueba T-018", borrar todo al final): 3 recorridos ≥ corte; factura A 0001-00000099 con 2 (saldo no cambia; quedan en "sin comprobante" solo 1); repetir número → error; interno con el 3.º (número 1) y descargar PDF; ND con 2 ítems y NC relacionada (saldo sube/baja); saldo inicial con 2 ítems; anular la factura (vuelven sus recorridos; el número no se reutiliza); intentar cambiar precio de un recorrido del interno → error. Borrar documentos, recorridos y cliente por Drizzle Studio/SQL.

## Fuera de alcance
- Recibos y su PDF (T-019); semáforo, vencido y PDF de estado de cuenta nuevo (T-020); edición de `payment_days` (T-020).
- Factura electrónica/CAE; PDF de factura (se hace en ARCA); editar comprobantes (se anula y se emite otro).

## Decisiones propuestas
- D1 Factura/interno con ítems libres (sin recorrido) — **Por defecto:** no se permiten (solo documentan recorridos; los cargos extra van por ND) · Alternativa: permitirlos y que sumen deuda como una ND.
  - ✅ Usuario: por defecto.
- D2 Recorridos anteriores al corte en factura/interno — **Por defecto:** no se pueden incluir (lo previo va por saldo inicial) · Alternativa: permitirlos como documentación sin efecto en saldo.
  - ✅ Usuario: por defecto.
- D3 PDF propio — **Por defecto:** solo para comprobante interno · Alternativa: también ND/NC/bonificación/saldo inicial sin letra fiscal (útil para mandarle el detalle del saldo inicial a Conocer).
  - ✅ Usuario: por defecto.
- D4 Logo del PDF — **Por defecto:** `frabel-logo.png` (color) · Alternativa: `frabel-logo-bw.png` (impresión en blanco y negro).
  - ✅ Usuario: por defecto.
- D5 Editar comprobantes sin número (saldo inicial, bonificación) — **Por defecto:** no; se anulan y se cargan de nuevo · Alternativa: permitir editar ítems mientras no tengan número.
  - ✅ Usuario: por defecto.

## Preguntas bloqueantes
- Ninguna

---

## Notas de implementación
- Nuevos: `src/lib/doc-number.ts`, `document-rules.ts` (+tests), `documents.ts`, `db-errors.ts` (`isUniqueViolation`/`pgCode`, usados por contactos y ventas), `company.ts`, `pdf-brand.tsx`, `document-pdf.tsx`; `finanzas/comprobantes/{page,actions,void-dialog}.tsx`, `nuevo/{page,document-form}.tsx`; `api/comprobante/[id]/route.tsx`.
- Tocados: `ledger.ts` (líneas informativas factura/interno con debe=haber=0, rank de débitos; `documentNumber` delega en `formatDocNumber`), `constants.ts` (MOVEMENT_KINDS + factura/interno), `balances.ts` (`getStatement` arma el ledger con todo y filtra por período; devuelve `debits`/`unappliedCredit`/`currentBalance` a hoy), `cuentas/[id]/page.tsx`, `ventas/actions.ts`, `rates.ts`, `app-sidebar.tsx`, `next.config.ts`.
- Decisión extra: todo comprobante salvo saldo inicial debe tener fecha ≥ `CC_START` (antes el ledger lo ignoraba en silencio). `VoidDialog` en archivo propio (page.tsx no puede exportar componentes).
- NC/bonificación/ND sin observación guardan el detalle de sus ítems en `notes` (es lo que muestra el estado de cuenta). Factura/interno guardan `due_date` explícito (fecha + `payment_days` por defecto).
- "Pendientes de cobro" usa el ledger completo (a hoy), no el período elegido. Totales del listado excluyen anulados salvo con filtro "Anulados".
- Prueba manual en navegador con "PRUEBA T-018" (todo borrado). PDF: 200 y `application/pdf` (~760 KB por el PNG del logo); no se pudo ver renderizado desde el navegador automatizado.

## Revisión
Veredicto: APROBADO
Criterios: CA1 ✅ · CA2 ✅ · CA3 ✅ · CA4 ✅ (reintento una vez ante 23505) · CA5 ✅ · CA6 ✅ · CA7 ✅ · CA8 ✅ · CA9 ✅ (PDF no visto renderizado) · CA10 ✅ · CA11 ✅ · CA12 ✅
Desvíos del implementador: todos correctos (fecha ≥ CC_START salvo saldo inicial evita que el ledger ignore en silencio; notes con detalle de ítems y due_date explícito son coherentes con el estado de cuenta; getStatement con historial completo filtrando por período es necesario para los pendientes y el FIFO).
Hallazgos:
1. [MENOR] src/lib/rates.ts:~70 — recalculateTripPrices saltea en silencio los recorridos con comprobante vigente (solo verificado con tsc) → tras cargar una tarifa nueva, esos recorridos conservan el precio viejo sin aviso → si molesta, informar la cantidad salteada en el mensaje de la acción de tarifas.
2. [MENOR] src/app/(app)/finanzas/comprobantes/actions.ts:~115 — la unicidad recorrido↔comprobante se valida sin transacción (carrera aceptada en la spec, un solo operador) → sin acción.
