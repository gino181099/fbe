# Memoria del proyecto

Conocimiento estable que no se deduce fácil del código. Leer antes de explorar. Mantener corto: 1–2 líneas por punto; si algo cambia, editar el punto (no agregar otro).

## Negocio

- Clientes **recurrentes** (agencias con tarifario) y **especiales** (servicios puntuales, precio a mano). Guardar un tarifario convierte al cliente en recurrente.
- Agencias: **Viajes Conocer** (cliente histórico; en la base vieja figura "Conocer") y **Huentata** (sin tarifario cargado aún).
- Los tarifarios se arman **a mano**; cambian seguido (inflación). Se versionan por fecha "vigente desde"; la versión anterior se cierra el día previo. No se quiere aumento automático por %.
- Tarifa = cliente + recorrido + **capacidad** (categoría de vehículo 8/14/18 plazas). Pasajeros ≠ capacidad (ej. 15 pax puede ir en categoría 14 o 18).
- La categoría "8" cubre de 8 a 13 pax (la Hiace de 13 se tarifica como 8). El vehículo asignado es solo un dato: **nunca** derivar capacidad/tarifa/precio del vehículo (por mantenimiento puede salir una de 19 en un servicio de 8).
- Cada recorrido guarda su precio (snapshot). Solo cambia si se edita o se usa "recalcular" al cargar una versión.
- Cuenta corriente (T-017, `src/lib/ledger.ts`): corte `CC_START` = 19/10/2026; antes no suma nada salvo `saldo_inicial` (ítems con fecha propia). Débitos = recorridos ≥ corte + ND + saldo inicial; créditos = NC + bonificación + `collection` ≥ corte (cobro y ajuste, hasta los recibos de T-019). Factura/interno **no** suman: agrupan recorridos y dan el vencimiento (si no, fecha + `client.payment_days`). Créditos: asignaciones explícitas y después FIFO a lo más viejo.
- Comprobantes: anular = `document.voided_at` (no se borra, el número no se reutiliza); un anulado no cuenta y libera sus recorridos. "Un recorrido en un solo factura|interno vigente" se valida en la acción (`tripsInActiveDocuments`), no con índice. "Cobrado" en reportes = solo `kind='cobro'`; los ajustes (`source='saldo-historico'`, `db:saldar-historico`) descuentan sin contar como cobrado. Inicio (serie mensual) sigue sobre todo el historial.
- Combustible por estación: **Axion Sarmiento** (histórica, cuenta corriente) y **Shell Maza**. Saldo estación = gasoil de recorridos + cargas extras − pagos (gastos categoría combustible con `supplier`).
- Potenciales (T-015): tipo `potencial` ⇔ en el embudo (`lead_stage` sin_contactar/contactado/perdido); "ganado" elige recurrente/especial y activa; perdido = inactivo. Sin recorridos hasta ganarlos. Notas de seguimiento en `client_note`; `auto=true` no se borran, las manuales solo su autor. Prospectos cargados con `db:import-potenciales` (idempotente, simula sin `--aplicar`).
- Gastos en reportes (T-016): costos directos (chofer + gasoil + adicionales de `trip`) + gastos generales (`expense` **sin** combustible + `fuel_load`); los gastos de combustible son pagos a estación del gasoil ya contado. En 2026 todos los costos están en `trip` (en `expense` y `fuel_load` no hay filas).
- Empresa (para PDFs): **TRANSPORTE FRA-BEL VIAJES S.R.L.** · Tel/WhatsApp +54 9 261 5124976 / 261 5124977 · frabelviajes@gmail.com · contacto Alejandra Delsouc. Logos en `public/brand/` (`frabel-logo.png` color con transparencia, `frabel-logo-bw.png` para impresión, `frabel-logo-original.jpg`). **Responsable Inscripto** · CUIT 30-71609318-9 · El Norteño 2156, Barrio Ferroviario, Maipú, Mendoza.
- Permisos: módulos `contactos|ventas|finanzas|usuarios` × `none|view|edit`. Admin (`is_admin`) tiene todo y no se puede editar; nadie edita sus propios permisos. Usuarios nuevos de Google entran `pending`.

## Datos importados (base SQLite vieja)

- `Servicio_Agencia.Capacidad` = pasajeros; la categoría tarifaria es el sufijo de `id_tarifa` ("Conocer-Alta Montaña-14").
- `Pagos_Varios` con Observaciones "Shell" → gasto combustible / Shell Maza. `Cargas_Extras` → `fuel_load` (consumo, no pago).
- `Servicio_Especial.Cliente` "-"/null → cliente "Particular"; "Impulsar" = **Impulsa Mendoza** (mapeado en `AGENCY_NAMES`). Fechas mal formadas se normalizan (`2025-1-07`).
- La importación es idempotente (`legacy_source` + `legacy_id`) y no pisa ediciones hechas en el ERP.
- Pendientes de datos: 3 viajes con precio 0 (2 Huentata, 1 City Tours 8 plazas); SRId 208 tenía `id_tarifa` contradictorio; cargas "Valor repetido".

## Decisiones técnicas

- Neon Postgres + Drizzle (driver `neon-http`); Auth.js v5 con JWT (requisito del provider Credentials); **no** se usa Neon Auth.
- Tablas server-rendered con filtros en la URL en vez de TanStack Table; formularios nativos + server actions en vez de react-hook-form.
- `xlsx` se instala desde el CDN oficial de SheetJS (la versión de npm tiene vulnerabilidades).
- Tests con Vitest sobre lógica pura extraída (`rates-plan.ts`, `statement.ts`); los archivos con `server-only`/`@/db` no se testean directo. Config en `vitest.config.mts` (con `.ts` Vite avisa por ESM en paquete CommonJS).
- Proveedor de combustible es texto libre con sugerencias (`src/lib/constants.ts`), no una tabla.

## Trampas

- `ALTER TYPE … ADD VALUE` y un UPDATE que use el valor nuevo van en migraciones distintas **y** en `db:migrate` separados (drizzle-kit aplica todas las pendientes en una transacción).
- FK con `onDelete: "restrict"` falla con código `23001` (no `23503`, que es de NO ACTION): chequear ambos al traducir errores de borrado.
- `PageProps<"/ruta">` de una página nueva no tipa hasta correr `npm run build` o `dev` (genera los tipos de rutas).
- Flota: `trip.driver` (texto) queda como histórico; mostrar `driver.name ?? trip.driver`. Textos compuestos ("Walter y Omar", "Sergio y Jose") quedan sin chofer.
- Mingo = Domingo Sículo (dueño); chofer propio desde `0006_chofer_domingo`.
- El registry de shadcn generó `import { cn } from "cn"`: al agregar componentes nuevos, corregir a `@/lib/utils`.
- PDFs nuevos: usar `PdfBrandHeader` (`src/lib/pdf-brand.tsx`, logo leído con `fs` + `outputFileTracingIncludes` en `next.config.ts`) y `formatDocNumber` (`src/lib/doc-number.ts`). Un `page.tsx` solo exporta default/metadata: componentes auxiliares van en archivo aparte.
- `/login` estática en build: si cambian las variables de Google hay que redeployar.
- Los clics de prueba en el navegador pueden fallar antes de la hidratación en dev: esperar y reintentar.
- "Jest worker encountered 2 child process exceptions" en dev = murió el worker de static paths (todas las rutas `[id]`); pasó con un `npm run dev` lanzado desde una terminal ya cerrada (EPIPE en `.next/dev/logs/next-development.log`). Fix: matar el server, borrar `.next/` y relanzar desde una terminal viva.
