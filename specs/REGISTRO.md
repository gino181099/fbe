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

## 2026-10-25 · T-031 · Descargar copia de la base
- Resultado: ícono de base de datos al pie del menú, visible solo para los usuarios de `DB_DOWNLOAD_USERS` (`gino`); `/api/copia-base` devuelve `frabel-AAAA-MM-DD-HHMM.json.gz` (mismo formato que los backups) y responde 403 a otros usuarios. La lectura de la base se movió a `src/lib/db-dump.ts`, compartido con `scripts/datos.ts`.
- Archivos: `src/app/api/copia-base/route.ts`, `src/lib/{db-dump,constants}.ts`, `src/components/app-sidebar.tsx`, `scripts/datos.ts`.
- Datos: —
- Verificación: tsc · lint · test · build · curl en `npm start` (gino 200 con 863 filas; gianella 403; sin sesión → login) · `db:backup` sigue andando · restauración de la copia en un Postgres aparte (`FRABEL_DATA_DIR` temporal, puerto 5434): 24 tablas OK.
- Pendiente: —
- Publicación: subido a Bitbucket (origin/main) el 2026-10-25.

## 2026-10-25 · T-030 · Diseño moderno (estilo Kanakku) y modo oscuro
- Resultado: solo estilo, sin cambiar funciones ni estructura. Paleta violeta #7539FF en `globals.css` (claro y oscuro), letra Instrument Sans, fondo gris #EEF0F4 con tarjetas blancas (`surface`), encabezado de tabla gris, estados en pastillas suaves, campos blancos. Menú agrupado (Principal/Comercial/Operación/Administración), comprimible a íconos (botón o Ctrl+B, se recuerda en cookie), con logo color en claro y blanco y negro invertido en oscuro. Botón luna/sol (`next-themes`, se recuerda por navegador).
- Archivos: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/components/{app-sidebar,page-header,theme-provider,theme-toggle,monthly-chart}.tsx`, `src/components/ui/{table,badge,card,input,native-select,textarea}.tsx`, contenedores de las páginas (`rounded-xl border` → `surface`), login, `public/brand/frabel-logo-bw-web.png`.
- Datos: —
- Verificación: tsc · lint · test · build · navegador en `npm start` (claro y oscuro: Inicio, Agenda, Contactos, Leads, Ventas + diálogo, Gastos; menú comprimido; 390 px sin desborde; consola limpia).
- Pendiente: —
- Publicación: subido a Bitbucket (origin/main) el 2026-10-25.

## 2026-10-25 · T-029 · Ayuda (i) en cada módulo
- Resultado: botón (i) al lado del título de las 19 páginas (salvo Usuarios, oculto); abre un panel lateral con "Para qué sirve", "Qué significa cada cosa" y "A tener en cuenta". 12 temas; las fichas y los "nuevo" usan el de su módulo.
- Archivos: `src/lib/help.ts` (textos), `src/components/{page-help,page-header}.tsx` (prop `help`), páginas de `src/app/(app)/`.
- Datos: —
- Verificación: tsc · lint · test · build · navegador en `npm start` (panel abierto en Ventas; botón presente en todas las rutas).
- Pendiente: que el equipo revise los textos.
- Publicación: subido a Bitbucket (origin/main) el 2026-10-25.

## 2026-10-25 · Auditoría · Peso de páginas y PDF de estado de cuenta
- Resultado: auditoría sin errores (tsc, lint, tests, todas las rutas 200, consola limpia). Los campos de edición por fila de Gastos y de Tarifas pasaron a componentes cliente: las listas viajan una vez y no por fila (Gastos 3,5 MB → 1,1 MB de HTML; contacto 464 → 214 KB). El estado de cuenta usa `PdfBrandHeader` (logo + datos fiscales) y los PDFs incrustan un logo de 256 px (`frabel-logo-pdf.png`, 38 KB; antes 750 KB por PDF).
- Archivos: `src/app/(app)/finanzas/fields.tsx`, `src/app/(app)/contactos/[id]/{page.tsx,rate-fields.tsx}`, `src/lib/{statement-pdf.tsx,pdf-brand.tsx}`, `public/brand/frabel-logo-pdf.png`.
- Datos: —
- Verificación: tsc · lint · test · build · medición con curl en `npm start` · PDF revisado.
- Pendiente: carrera menor en `createReceipt` (validación de pendientes fuera de transacción), poco probable con 4 usuarios.
- Publicación: subido a Bitbucket (origin/main) el 2026-10-25.

## 2026-10-25 · T-028 · Pago del cliente al cargar el recorrido
- Resultado: "Nuevo recorrido" tiene dos casillas (arrancan desmarcadas, excluyentes): "El cliente ya pagó" (por el precio) y "El cliente hizo un pago parcial" (monto + medio de pago). Al guardar crea el recorrido y un recibo X con fecha de hoy imputado a ese recorrido, en una transacción. Solo en el alta; recorridos anteriores al corte no aceptan pago.
- Archivos: `src/app/(app)/ventas/{actions.ts,trip-form.tsx,page.tsx}`.
- Datos: —
- Verificación: tsc · lint · build · prueba en `npm start` (parcial 40.000 de 100.000 → recibo + `receipt_trip` correctos; datos de prueba borrados).
- Pendiente: —

## 2026-10-25 · T-027 · Actividades de hoy en el Inicio
- Resultado: el Inicio arranca con "Tus actividades de hoy": las del usuario logueado vencidas (rojo) y de hoy (amarillo), con hecha/reprogramar/editar/eliminar y link a la agenda; resumen "N para hoy · M vencidas".
- Archivos: `src/app/(app)/page.tsx` (consulta en paralelo con el resto del tablero).
- Datos: —
- Verificación: tsc · lint · build · navegador: con 4 PRUEBA (vencida, hoy, futura, de otro usuario) solo salen las 2 correctas; marcar hecha la saca y baja el contador del menú. PRUEBA borradas.
- Publicación: subido a Bitbucket (`origin/main`) el 2026-10-25.

## 2026-10-25 · T-026 · Calendario de la agenda y actividades por vehículo
- Resultado: `/agenda` abre en calendario mensual (lunes a domingo, ← → y "Hoy", filtro de usuario) con colores de Odoo (rojo vencida, amarillo hoy, verde planificada, gris hecha); arrastrar una actividad a otro día la reprograma; clic abre el detalle con hecha/reprogramar/editar/eliminar. Lista también con punto de color. Ficha `/flota/[id]` con actividades y últimos gastos; en Flota la patente enlaza a la ficha con punto de color y cantidad pendiente.
- Archivos: `src/lib/{calendar(+test),activity-bucket,activities}.ts`, `src/components/{activity-calendar,calendar-dnd,activity-list}.tsx`, `src/app/(app)/agenda/page.tsx`, `src/app/(app)/flota/{page,[id]/page}.tsx`.
- Datos: — (sin migración).
- Verificación: tsc · lint · npm test 161/161 · build · navegador en `npm start`: colores correctos con 6 actividades PRUEBA, arrastre del 22 al 28 (pasó de rojo a verde), detalle al clic, punto verde/rojo en Flota, ficha AH115DL. PRUEBA borradas.
- Publicación: subido a Bitbucket (`origin/main`) el 2026-10-25.

## 2026-10-25 · T-025 · Usuarios, agenda y auditoría
- Resultado: login eligiendo Gino/Gianella/Ale/Mingo + clave única (recuerda el último en la PC); `/agenda` (mías/de todos/de alguien, vencidas/hoy/7 días/después, hecha con resultado + "programar la siguiente", reprogramar, reabrir), contador en el menú, panel de actividades en contacto, oportunidad y proveedor (vehículo se elige en el form); "Creado/Modificado por" en diálogos de edición y fichas (recorridos, gastos, cargas, proveedores y pagos, flota, contactos, leads, comprobantes y recibos — en estos, al anular y en el `title` del estado).
- Archivos: `src/db/schema.ts` (`activity`, `audited()`), `src/lib/{audit,activities,activity-bucket(+test),constants,format,permissions,rates}.ts`, `src/components/{activity-fields,activity-list,activities-panel,audit-info,app-sidebar,confirm-button}.tsx`, `src/app/(app)/agenda/**`, todas las `actions.ts` con alta/edición, `src/auth.ts`, login, `scripts/datos.ts`.
- Datos: `0013_agenda_y_auditoria` (tabla + columnas; `frabel` → `gino`, alta de los otros 3; lo histórico `created_by` = Gino). Datos iniciales re-exportados (863 filas).
- Verificación: tsc · lint · npm test 154/154 · build · navegador en `npm start`: login Gianella, actividad asignada a Mingo con vehículo, hecha con nota, desde contacto: agendar, contador 1, hecha + siguiente al 28/10; "Creado por Gino". Actividades PRUEBA borradas.
- Publicación: subido a Bitbucket (`origin/main`) el 2026-10-25. Producción todavía no instalada: cuando se instale, toma esta versión y los datos iniciales re-exportados.

## 2026-10-25 · Instalación de producción en un comando
- Resultado: datos separados del código en `C:\FrabelERP-datos`; datos iniciales por el repo (`db:exportar-inicial` / `db:inicializar`, nunca pisa una base con datos); `instalar.bat` hace todo (firewall, arranque automático, sin suspensión, muestra IP); guía reescrita con tutorial para fijar la IP.
- Archivos: `scripts/datos.ts`, `src/lib/config.ts`, `instalar.bat`, `actualizar.bat`, `GUIA-INSTALACION.md`, `README.md`, `datos-iniciales/frabel-inicial.json.gz`.
- Datos: base de desarrollo movida a `C:\FrabelERP-datos` (se movió con Postgres corriendo; recuperada y verificada idéntica al volcado previo, 23 tablas).
- Verificación: tsc · instalación simulada en carpeta/puerto temporal: 860 filas OK y segunda corrida no pisa.
- Pendiente: re-exportar datos iniciales cuando el usuario termine de cargar; tras instalar producción, sacar `datos-iniciales/` del repo.

## 2026-10-25 · Fix · Tarjetas de Gastos desbordadas
- Resultado: en `/finanzas/gastos` los 6 totales (millones) se pisaban; ahora 3 por fila (6 recién en `2xl`) y `StatCard` achica la letra y corta el monto en vez de desbordar (aplica a todas las pantallas).
- Archivos: `src/app/(app)/finanzas/gastos/page.tsx`, `src/components/page-header.tsx`; `specs/TAREAS.md` (acciones manuales al día con el paso a local; T-002 quitada, sin sentido con clave única).
- Datos: —
- Verificación: tsc · lint · build · navegador en `npm start`: Gastos y Combustible bien.

## 2026-10-25 · T-024 · ERP local (Postgres por npm) y clave única
- Resultado: base Postgres 18 local instalada con npm (`@embedded-postgres/windows-x64`), datos de Neon copiados; login con clave única `belinda2156`; arranque/instalación/actualización por `.bat`; backups automáticos.
- Archivos: `src/lib/config.ts`, `src/db/index.ts`, `src/auth.ts`, `src/app/(auth)/**`, `scripts/{db,local,datos}.ts`, `*.bat`, `drizzle.config.ts`, `package.json`, `README.md`; `db.batch` → `db.transaction` en `rates.ts`, `contactos`, `leads`, `usuarios`, `saldar-historico`. Borrados `seed-admin.ts`, `vercel.json`.
- Datos: copia Neon → local, 860 filas, conteos iguales en las 23 tablas.
- Verificación: tsc · lint · npm test 149/149 · build · `npm start`: backup al arrancar, clave errónea rechazada, login OK con los datos copiados.
- Pendiente: crear el repo de Bitbucket y hacer push; instalar en la PC de la oficina (`instalar.bat` + `db:restore` del último backup); regla de firewall; no probé escrituras en transacción desde la UI.

## 2026-10-20 · T-023 · Leads (CRM de oportunidades), notas y velocidad
- Resultado: `/leads` (Kanban con arrastre + "Mover a…", lista con filtros, ficha con notas); ganar crea/activa el cliente, perder pide motivo; Contactos sin potenciales y con pestaña Oportunidades; `NotesPanel` común con notas cruzadas contacto↔oportunidad; `loading.tsx`, usuario+permisos en una consulta, saldo de un solo cliente en la ficha.
- Archivos: `src/app/(app)/leads/**`, `src/lib/{leads(+test),lead-options,balances,permissions,format,constants}.ts`, `src/components/{notes-panel,badges,app-sidebar}.tsx`, `contactos/**`, `usuarios/*`, `(app)/loading.tsx`, `schema.ts`, `vercel.json`.
- Datos: `0011_modulo_leads` (enum) y `0012_leads` (tablas + 29 leads/29 notas desde potenciales + permiso `leads` = nivel de contactos). Clientes 38 antes y después; datos PRUEBA creados y borrados.
- Verificación: tsc · lint · npm test 149/149 · build OK · navegador en `next start`: crear, arrastrar Nuevo→Contacto, Propuesta, Ganado (creó cliente), reabrir, Perdido con motivo, nota cruzada visible en el contacto.
- Pendiente: probar un usuario sin permiso `leads`; mover el proyecto fuera de OneDrive para que `npm run dev` ande rápido.

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
