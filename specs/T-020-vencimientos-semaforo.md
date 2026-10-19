# T-020 · Vencimientos y semáforo de mora

- Estado: Borrador
- Prioridad: Media
- Riesgo: Alto (refactoriza la carga de datos del ledger en `balances.ts` y muestra montos vencidos; sin esquema)
- Fecha: 2026-10-19
- Tarea: `specs/TAREAS.md` → T-020 · Base: T-017 (`dueDate` por débito), T-018 (`pdf-brand.tsx`, "Pendientes de cobro"), T-019 (recibos en el ledger)

## Contexto
El ledger de T-017 ya calcula `dueDate`, `remaining` y `status` por débito, pero nadie lo muestra como mora. El usuario quiere ver de un vistazo quién debe y cuánto hace (semáforo como en `panel_cobranzas`) y editar los días de pago por cliente.

## Objetivo
En Cuentas corrientes, el estado de cuenta y su PDF se ven saldo, vencido, días de atraso y semáforo por cliente; se puede filtrar por mora y cambiar el plazo de pago de cada cliente.

## Criterios de aceptación
- [ ] CA1 Lógica pura en `src/lib/ledger.ts` (o `src/lib/aging.ts`): `daysOverdue(dueDate, ref)` y `agingLevel(days)` → `al_dia` (sin atraso o saldo ≤ 0) · `verde` 1–30 · `amarillo` 31–60 · `rojo` > 60; `summarizeAging(debits, ref)` → `{ overdue, notDue, maxDaysOverdue, level, oldestDueDate }` sobre débitos con `remaining > 0`. Vence el mismo día = no vencido.
- [ ] CA2 Tests: límites 0/1/30/31/60/61, débito cancelado no cuenta, parcial cuenta solo su pendiente, saldo a favor → `al_dia`, vencimiento por comprobante vs por `paymentDays`, anulados excluidos.
- [ ] CA3 `AGING_LEVELS` + `AGING_LEVEL_LABELS` ("Al día", "Hasta 30 días", "31 a 60 días", "Más de 60 días") en `src/lib/constants.ts`; badge `AgingBadge` (verde/amarillo/rojo/neutro) en `src/components/badges.tsx`.
- [ ] CA4 `/finanzas`: columnas Saldo, Vencido, Atraso (días) y Semáforo; tarjetas "Saldo a cobrar", "Vencido" y conteo por color; filtro GET `mora=vencidos|verde|amarillo|rojo` (con `todos=1` existente); orden por defecto: más días de atraso primero, después saldo.
- [ ] CA5 `/finanzas/cuentas/[id]`: StatCard "Vencido" con semáforo; en "Pendientes de cobro" (T-018) columnas Vence, Días de atraso y badge por fila.
- [ ] CA6 PDF de estado de cuenta: encabezado con `pdf-brand.tsx` (logo + datos de la empresa), etiqueta por tipo de movimiento en el detalle, resumen con "Vencido al <fecha>" y tabla "Pendientes" (fecha, detalle, vence, días de atraso, pendiente).
- [ ] CA7 Fecha de referencia: listado = `today()`; estado de cuenta (pantalla y PDF) = `hasta` del período (créditos hasta esa fecha).
- [ ] CA8 `payment_days` editable en el formulario de cliente (Contactos): entero 0–365, por defecto 30, hint "Días para el vencimiento de recorridos sin comprobante"; cambiarlo recalcula vencimientos sin tocar `due_date` ya guardados en comprobantes.
- [ ] CA9 Una sola carga de datos para todos los clientes (no N consultas por cliente): ~6 consultas fijas desde el corte y ledger por cliente en memoria.

## Diseño
### Datos
Sin cambios de esquema ni migración (`client.payment_days` existe desde 0007). Solo lectura salvo `payment_days`.
### Permisos
`finanzas` view para ver mora; `payment_days` se edita con `contactos` edit (es dato del cliente), mostrado solo si el usuario tiene además `finanzas` view.
### UI
Badge con punto de color + texto; "Al día" en gris. Vencido en rojo si > 0. Textos de filtro: "Mora: Todos / Con vencidos / Hasta 30 / 31 a 60 / Más de 60".

## Mapa de código
- `src/lib/ledger.ts` (T-017/T-019): agregar `daysOverdue`, `agingLevel`, `summarizeAging`; tests en `ledger.test.ts`. Diferencia de días con fechas string sin zona horaria (como `lastDayOfMonth` en `src/lib/statement.ts` ~86, `Date.UTC`).
- `src/lib/balances.ts`: extraer de `getStatement` un `loadLedgerInputs(clientIds?, to?)` (trips ≥ corte, documentos vigentes con ítems, collection ≥ corte, recibos vigentes + `receipt_trip`, `payment_days`) y agruparlo por cliente; nuevo `getAging(ref)` → `Map<clientId, AgingSummary & { balance }>`; `getStatement` agrega `aging` y la lista de pendientes con `daysOverdue`/`level`. `getBalances` puede seguir en SQL agregado (no cambiar sus números).
- `src/lib/constants.ts`: `AGING_LEVELS`, `AgingLevel`, `AGING_LEVEL_LABELS`, umbrales `AGING_THRESHOLDS = [30, 60]`. (T-021/T-022 también editan este archivo: agregar en un bloque propio.)
- `src/components/badges.tsx`: `AgingBadge` imitando `ClientTypeBadge`.
- `src/app/(app)/finanzas/page.tsx` (~17-37 datos y filtro, ~52-57 tarjetas, ~60-93 tabla): sumar `getAging(today())`, filtro `mora`, columnas nuevas.
- `src/app/(app)/finanzas/cuentas/[id]/page.tsx`: StatCards (~90-102) y sección "Pendientes de cobro" de T-018.
- `src/lib/statement-pdf.tsx` (~38-50 encabezado → `pdf-brand.tsx`; ~73-81 badge de tipo con `MOVEMENT_KIND_LABELS`; ~83-106 resumen + tabla de pendientes). `src/app/api/estado-cuenta/[clientId]/route.tsx` sin cambios salvo tipos.
- `src/app/(app)/contactos/client-fields.tsx` (~37-46, junto a CUIT): campo `paymentDays`; `src/app/(app)/contactos/actions.ts` › `clientSchema` (~16): `paymentDays: z.coerce.number().int().min(0).max(365)` con mensajes en español, opcional → default 30 al crear.
- `specs/MEMORIA.md`: regla del semáforo (umbrales, referencia = hoy / `hasta`).

## Plan
- [ ] 1. Funciones de mora + constantes + tests.
- [ ] 2. `loadLedgerInputs` + `getAging` en `balances.ts`; `getStatement` con `aging`.
- [ ] 3. Listado `/finanzas` con columnas, tarjetas y filtro.
- [ ] 4. Estado de cuenta (pantalla) y PDF.
- [ ] 5. `payment_days` en Contactos; MEMORIA.

## Verificación
- `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build` (una vez, al final)
- Comparar antes/después: el saldo de cada cliente en `/finanzas` no cambia.
- Manual (cliente "Prueba T-020", `payment_days` 30, borrar todo al final): saldo inicial con ítems de fechas hoy−10, hoy−45 y hoy−90 (verde/amarillo/rojo → cliente rojo, vencido = Σ); recibo que cancele el más viejo por FIFO (pasa a amarillo); cambiar `payment_days` a 60 (pasa a verde); filtrar por mora; descargar el PDF y revisar la tabla de pendientes. Borrar documentos, recibos y cliente.

## Fuera de alcance
- Avisos/recordatorios automáticos por mail o WhatsApp; intereses por mora.
- Semáforo en Inicio o Contactos (se puede recomendar después).
- Mora de proveedores (T-021).

## Decisiones propuestas
- D1 Semáforo del cliente — **Por defecto:** el del débito vencido más viejo (máximo atraso) · Alternativa: ponderado por monto (el color del tramo con más plata vencida).
- D2 Referencia del estado de cuenta — **Por defecto:** la fecha `hasta` del período · Alternativa: siempre hoy.
- D3 Dónde se edita `payment_days` — **Por defecto:** formulario de cliente en Contactos · Alternativa: también un diálogo en la cuenta corriente (Finanzas).
- D4 "Verde" con 1–30 días de atraso — **Por defecto:** tal cual lo pidió el usuario (verde = vencido reciente, distinto de "Al día" gris) · Alternativa: "Al día" en verde y 1–30 en amarillo claro.

## Preguntas bloqueantes
- Ninguna

---

## Notas de implementación
_(completa el implementador: desvíos del plan, decisiones, archivos tocados)_

## Revisión
_(completa el revisor)_
