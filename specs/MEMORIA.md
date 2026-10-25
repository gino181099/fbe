# Memoria del proyecto

Conocimiento estable que no se deduce fácil del código. Leer antes de explorar. Mantener corto: 1–2 líneas por punto; si algo cambia, editar el punto (no agregar otro).

## Negocio

- Clientes **recurrentes** (agencias con tarifario) y **especiales** (servicios puntuales, precio a mano). Guardar un tarifario convierte al cliente en recurrente.
- Agencias: **Viajes Conocer** (cliente histórico; en la base vieja figura "Conocer") y **Huentata** (sin tarifario cargado aún).
- Los tarifarios se arman **a mano**; cambian seguido (inflación). Se versionan por fecha "vigente desde"; la versión anterior se cierra el día previo. No se quiere aumento automático por %.
- Tarifa = cliente + recorrido + **capacidad** (categoría de vehículo 8/14/18 plazas). Pasajeros ≠ capacidad (ej. 15 pax puede ir en categoría 14 o 18).
- La categoría "8" cubre de 8 a 13 pax (la Hiace de 13 se tarifica como 8). El vehículo asignado es solo un dato: **nunca** derivar capacidad/tarifa/precio del vehículo (por mantenimiento puede salir una de 19 en un servicio de 8).
- Cada recorrido guarda su precio (snapshot). Solo cambia si se edita o se usa "recalcular" al cargar una versión.
- Cuenta corriente (T-017, `src/lib/ledger.ts`): corte `CC_START` = 19/10/2026; antes no suma nada salvo `saldo_inicial` (ítems con fecha propia). Débitos = recorridos ≥ corte + ND + saldo inicial; créditos = NC + bonificación + recibos vigentes (T-019) + `collection` ≥ corte (si las hubiera; ya no se cargan). Factura/interno **no** suman: agrupan recorridos y dan el vencimiento (si no, fecha + `client.payment_days`). Créditos: asignaciones explícitas (`receipt_trip`) y después FIFO a lo más viejo.
- Recibos (T-019): `receipt` X 0001-N correlativo (max+1, anulados incluidos); anular = `voided_at`. Solo se tildan recorridos ≥ corte con pendiente (validado en `createReceipt` con `pendingTripAmounts`). Cobros (`collection`) = historial de solo lectura. "Cobrado" (Inicio, reportes, saldos) = `collection` kind cobro + recibos vigentes.
- Comprobantes: anular = `document.voided_at` (no se borra, el número no se reutiliza); un anulado no cuenta y libera sus recorridos. "Un recorrido en un solo factura|interno vigente" se valida en la acción (`tripsInActiveDocuments`), no con índice. "Cobrado" en reportes = `kind='cobro'` + recibos; los ajustes (`source='saldo-historico'`, `db:saldar-historico`) descuentan sin contar como cobrado. Inicio (serie mensual) sigue sobre todo el historial.
- Combustible por estación: **Axion Sarmiento** (histórica, cuenta corriente) y **Shell Maza**. Saldo estación = gasoil de recorridos + cargas extras − pagos (gastos categoría combustible + `supplier_payment`). Proveedores (T-021): tabla `supplier`; estaciones vinculadas a `trip`/`fuel_load` por `lower(trim(nombre))`, sin FK; saldo = gastos `paid=false` no combustible + consumo − pagos (`src/lib/supplier-ledger.ts`).
- Leads (T-023, reemplaza el embudo de T-015): tabla `lead` (oportunidad) con etapas `nuevo|contacto|propuesta|ganado|perdido`, permiso propio `leads`, Kanban en `/leads`. Los datos de la empresa viven en el lead; `client_id` opcional (propuesta a cliente existente). Ganado crea el cliente (o vincula uno con el mismo nombre) o activa al potencial vinculado; perdido pide motivo e inactiva al potencial. Reglas en `src/lib/leads.ts`. Contactos oculta `type='potencial'`; `client.lead_stage` y `db:import-potenciales` quedan históricos. Los 29 potenciales se migraron como leads vinculados (0012).
- Notas: `client_note` y `lead_note` (`auto=true` no se borran; las manuales solo su autor). Componente común `NotesPanel` (`src/components/notes-panel.tsx`); la ficha del contacto muestra también las notas de sus oportunidades y viceversa (`mergeNotes` deduplica las copiadas al migrar).
- Gastos en reportes (T-016): costos directos (chofer + gasoil + adicionales de `trip`) + gastos generales (`expense` **sin** combustible + `fuel_load`); los gastos de combustible son pagos a estación del gasoil ya contado. En 2026 todos los costos están en `trip` (en `expense` y `fuel_load` no hay filas). Gastos (T-022): categorías vehiculo/personal/generales/combustible; `scope='vehiculo'` ⇔ `vehicle_id` (CHECK); reglas en `src/lib/expense-rules.ts`; Flota suma solo `scope='vehiculo'` sin combustible.
- Empresa (para PDFs): **TRANSPORTE FRA-BEL VIAJES S.R.L.** · Tel/WhatsApp +54 9 261 5124976 / 261 5124977 · frabelviajes@gmail.com · contacto Alejandra Delsouc. Logos en `public/brand/` (`frabel-logo.png` color con transparencia, `frabel-logo-bw.png` para impresión, `frabel-logo-original.jpg`). **Responsable Inscripto** · CUIT 30-71609318-9 · El Norteño 2156, Barrio Ferroviario, Maipú, Mendoza.
- Permisos: módulos `contactos|leads|ventas|finanzas|usuarios` × `none|view|edit`. Admin (`is_admin`) tiene todo y no se puede editar; nadie edita sus propios permisos. (Desde T-024 todos entran con la clave única como el admin `frabel`; los permisos por usuario quedan sin uso.)

## Datos importados (base SQLite vieja)

- `Servicio_Agencia.Capacidad` = pasajeros; la categoría tarifaria es el sufijo de `id_tarifa` ("Conocer-Alta Montaña-14").
- `Pagos_Varios` con Observaciones "Shell" → gasto combustible / Shell Maza. `Cargas_Extras` → `fuel_load` (consumo, no pago).
- `Servicio_Especial.Cliente` "-"/null → cliente "Particular"; "Impulsar" = **Impulsa Mendoza** (mapeado en `AGENCY_NAMES`). Fechas mal formadas se normalizan (`2025-1-07`).
- La importación es idempotente (`legacy_source` + `legacy_id`) y no pisa ediciones hechas en el ERP.
- Pendientes de datos: 3 viajes con precio 0 (2 Huentata, 1 City Tours 8 plazas); SRId 208 tenía `id_tarifa` contradictorio; cargas "Valor repetido".

## Decisiones técnicas

- **Todo local desde 2026-10-25 (T-024)**: Postgres 18 con binarios de npm (`@embedded-postgres/windows-x64`, manejado por `scripts/db.ts` con `pg_ctl`, puerto 5433, solo localhost) + Drizzle `node-postgres`. Datos en `C:\FrabelERP-datos\{postgres,backups}` (ruta fija de la PC, no del usuario de Windows; fuera del repo y de OneDrive; override `FRABEL_DATA_DIR`). Neon quedó solo como respaldo viejo.
- **Dos PCs**: esta = desarrollo (datos de prueba); oficina = producción (la única base que vale). Los cambios de código no llevan datos. Primera instalación: `npm run db:exportar-inicial` → `datos-iniciales/frabel-inicial.json.gz` al repo → `instalar.bat` corre `db:inicializar`, que carga solo si no hay datos de negocio (`client|trip|expense|user`). Con producción andando, quitar `datos-iniciales/` del repo. Volcados de una migración anterior se aceptan (migraciones aditivas); de una posterior, no.
- `instalar.bat` también: regla de firewall (pide UAC vía `Start-Process -Verb RunAs`), acceso directo minimizado en la carpeta Inicio, `powercfg standby-timeout-ac 0`, muestra la IP.
- Config fija en `src/lib/config.ts` (pedido del usuario: nada en `.env`): clave única `belinda2156`, `AUTH_SECRET`, URL de la base. Sin Google ni adapter; Usuarios oculto del sidebar.
- **Usuarios (T-025)**: `LOGIN_USERS` en `constants.ts` (gino, gianella, ale, mingo), todos admin con la misma clave; el login elige el usuario (radios) y `authorize` hace upsert por username. Los crea la migración 0013 (el viejo `frabel` pasó a `gino` conservando su id). Agregar alguien = sumarlo a `LOGIN_USERS` (se crea al primer login; para asignarle actividades antes, insertarlo en una migración).
- **Auditoría**: columnas `created_by`/`updated_by` (+ `updated_at` donde faltaba) vía `audited()` en `schema.ts`; las acciones esparcen `created(user.id)` / `updated(user.id)` de `src/lib/audit.ts`. Mostrar con `<AuditInfo row names>` (`getUserNames()` en la página) o `auditText` para `title`. Tabla nueva con alta/edición ⇒ agregarle `...audited()` y usar los helpers.
- **Agenda**: tabla `activity` (asignada a, vence, hecha = `done_at`, vínculo opcional a contacto/lead/vehículo/proveedor con cascade). Acciones sin módulo de permisos: `checkUser()`. Revalida `"/"` layout (contador del menú). `ActivitiesPanel` para cualquier ficha con `link={{ field, id, label }}`.
- Escrituras múltiples con `db.transaction(async (tx) => …)` (ya no `db.batch`). Sin `pg_dump`: backup/restore/copia en `scripts/datos.ts` (JSON.gz, valores como texto, `session_replication_role=replica`, reajusta secuencias). Backup automático en cada `npm start`.
- Despliegue: `instalar.bat` / `iniciar-erp.bat` / `actualizar.bat` (git pull desde Bitbucket); `next start -H 0.0.0.0` para la red.
- Auth.js v5 con JWT (requisito del provider Credentials).
- Tablas server-rendered con filtros en la URL en vez de TanStack Table; formularios nativos + server actions en vez de react-hook-form.
- `xlsx` se instala desde el CDN oficial de SheetJS (la versión de npm tiene vulnerabilidades).
- Tests con Vitest sobre lógica pura extraída (`rates-plan.ts`, `statement.ts`); los archivos con `server-only`/`@/db` no se testean directo. Config en `vitest.config.mts` (con `.ts` Vite avisa por ESM en paquete CommonJS).
- Proveedor en `trip.fuel_supplier`/`fuel_load.supplier` sigue texto libre; `expense.supplier_id` es FK a `supplier` (el texto `expense.supplier` queda histórico). Unicidad de nombre por índice sobre `lower(name)`.

## Trampas

- `ALTER TYPE … ADD VALUE` y un UPDATE que use el valor nuevo van en migraciones distintas **y** en `db:migrate` separados (drizzle-kit aplica todas las pendientes en una transacción). Alternativa en una sola migración (T-022): columna a `text` → `UPDATE` → `DROP/CREATE TYPE` → `USING col::tipo` (drizzle-kit lo genera al quitar valores; insertar el UPDATE en medio).
- FK con `onDelete: "restrict"` falla con código `23001` (no `23503`, que es de NO ACTION): chequear ambos al traducir errores de borrado.
- `PageProps<"/ruta">` de una página nueva no tipa hasta correr `npm run build` o `dev` (genera los tipos de rutas).
- Flota: `trip.driver` (texto) queda como histórico; mostrar `driver.name ?? trip.driver`. Textos compuestos ("Walter y Omar", "Sergio y Jose") quedan sin chofer.
- Mingo = Domingo Sículo (dueño); chofer propio desde `0006_chofer_domingo`.
- El registry de shadcn generó `import { cn } from "cn"`: al agregar componentes nuevos, corregir a `@/lib/utils`.
- PDFs nuevos: usar `PdfBrandHeader` (`src/lib/pdf-brand.tsx`, logo leído con `fs` + `outputFileTracingIncludes` en `next.config.ts`) y `formatDocNumber` (`src/lib/doc-number.ts`). Un `page.tsx` solo exporta default/metadata: componentes auxiliares van en archivo aparte.
- Probar lógica `server-only` contra la base sin la app: `npx tsx --conditions=react-server --env-file=.env.local <script>` (en Windows, imports dinámicos con `file:///C:/…/archivo.ts`).
- Velocidad: en dev Next compila cada ruta la primera vez y el proyecto está en OneDrive (sincroniza `.next/`): medir con `npm run build && npm start`. `(app)/loading.tsx` da respuesta inmediata al navegar.
- `pg_ctl start` con stdio heredado deja colgado a quien lanzó el script (postgres hereda el pipe): usar `stdio: "ignore"`. Las migraciones siembran `vehicle`/`driver`/`supplier`: una base "nueva" no está vacía. Scripts `tsx` sin top-level await (salen en CJS).
- Fechas de `timestamp` (createdAt) a día: `dayInAR(d)` de `src/lib/format.ts`, nunca `toISOString()` (de noche en AR da el día siguiente).
- Windows: cortar `npm start`/`npx next start` en background no mata el `node` hijo; liberar el puerto con `Stop-Process` sobre el PID que escucha (`Get-NetTCPConnection -LocalPort 3000`). Postgres sigue corriendo aparte (`npm run db:stop`).
- `StatCard` con montos de millones: más de 3 por fila desbordaba (Gastos tenía 6 en `lg`). `StatCard` ahora achica la letra y corta antes de desbordar; filas de muchas tarjetas: `sm:grid-cols-3 2xl:grid-cols-6`.
- **Nunca mover/copiar la carpeta de datos con Postgres corriendo**, y antes de cambiar `DATA_ROOT`/`PG_DATA_DIR` detenerlo con la ruta vieja (`db:stop` usa la ruta de la config actual y dice "no estaba corriendo"). Si pasa: matar `postgres.exe`, borrar `postmaster.pid`, arrancar (hace recuperación) y comparar contra un volcado (`compare` de tablas JSON).
- Después de una migración que toque usuarios o columnas, **re-exportar `datos-iniciales/`** mientras siga en el repo (si no, producción arranca con el esquema/usuarios viejos). `hasBusinessData` no cuenta `user` (la migración siembra usuarios).
- Rutas nuevas: `npx next typegen` genera los tipos de `PageProps<"/ruta">` sin hacer build. Lint prohíbe `setState` dentro de `useEffect` (react-hooks/set-state-in-effect): para recordar valores de `localStorage` tocar el DOM (ej. radios) en vez de estado.
- Probar instalación limpia sin tocar la base real: `FRABEL_DATA_DIR=%TEMP%\x` + `PG_PORT=5434` y correr `db:setup` / `db:inicializar`.
- Probar UI siempre en `npm run build && npm start` contra la base local (es la forma en que corre en la oficina).
- Los clics de prueba en el navegador pueden fallar antes de la hidratación en dev: esperar y reintentar.
- "Jest worker encountered 2 child process exceptions" en dev = murió el worker de static paths (todas las rutas `[id]`); pasó con un `npm run dev` lanzado desde una terminal ya cerrada (EPIPE en `.next/dev/logs/next-development.log`). Fix: matar el server, borrar `.next/` y relanzar desde una terminal viva.
