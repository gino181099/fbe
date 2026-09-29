# T-015 · Tratamiento de clientes potenciales y seguimiento

- Estado: Implementada <!-- Borrador → Aprobada → Implementada -->
- Prioridad: Media
- Fecha: 2026-09-28
- Tarea: `specs/TAREAS.md` → T-015

## Contexto
Hoy `client.status` ya admite `potencial`, pero no hay embudo comercial: no se sabe si a un prospecto ya se lo contactó, si se ganó o si se perdió, y no hay dónde anotar las acciones hechas ("se envió el mail X y no respondieron", "pidió cuenta corriente"). Además hay una lista de 30 prospectos (`clientes_potenciales_2026-09-28.json`, en la raíz) que hay que cargar en la base de **producción** sin duplicar nada.

## Objetivo
El usuario puede:
1. Ver los potenciales separados por etapa (Sin contactar / Contactado / Ganado / Perdido) y moverlos de etapa. Mientras son prospectos tienen tipo **Potencial**; recién al marcarlos como "Ganado" se elige si son recurrentes o especiales y pasan a cliente activo.
2. Registrar y consultar un historial de seguimiento (observaciones con fecha y autor) en **cualquier** contacto, sea potencial o cliente.
3. Tener cargados los 30 prospectos del JSON mediante un script idempotente.

## Criterios de aceptación
- [ ] CA1 `CLIENT_TYPES` pasa a ser `["recurrente", "especial", "potencial"]` (valor nuevo en el enum `client_type`). `client` tiene la columna `lead_stage` (enum `sin_contactar|contactado|ganado|perdido`, nullable) y las columnas `website`, `segment` y `lead_priority` (texto, nullable). Existe la tabla `client_note`.
- [ ] CA2 Con las migraciones aplicadas, todo cliente existente con `status='potencial'` queda con `type='potencial'` y `lead_stage='sin_contactar'`; los demás quedan con su tipo y con `lead_stage` en `NULL`.
- [ ] CA3 `ClientTypeBadge` muestra "Potencial". En `/contactos`, el filtro Tipo tiene la opción "Potenciales"; con Estado = Potenciales aparece un filtro "Etapa" (form GET, `?etapa=`) y una columna "Etapa" con badge.
- [ ] CA4 En `/contactos/[id]` de un potencial, un usuario con `contactos:edit` ve un selector de etapa. Pasar a "Contactado" solo cambia `lead_stage`. Pasar a "Perdido" pone `lead_stage='perdido'` y `status='inactivo'` sin cambiar el tipo.
- [ ] CA5 Pasar a "Ganado" abre un diálogo que **exige** elegir Tipo, **solo** Recurrente o Especial. Al confirmar: `lead_stage='ganado'`, `status='activo'`, `type` = el elegido. Si elige Recurrente, el mensaje recuerda cargar el tarifario.
- [ ] CA6 Coherencia de tipo y estado, validada en las acciones de contactos: `type='potencial'` ⇔ el contacto está en el embudo (etapa `sin_contactar`, `contactado` o `perdido`). En el formulario de alta y edición, elegir Estado = Potencial fuerza Tipo = Potencial, y un cliente activo no puede tener tipo Potencial ("Elegí si es recurrente o especial"). `saveRateVersion` sigue convirtiendo a recurrente.
- [ ] CA7 Un contacto con `type='potencial'` no aparece en el selector de clientes de Ventas (`trip-form.tsx` agrupa solo recurrentes y especiales), y `buildTrip` en `ventas/actions.ts` rechaza cargar un recorrido para él con "Es un cliente potencial: marcalo como ganado antes de cargarle recorridos."
- [ ] CA8 Cada cambio de etapa agrega automáticamente una nota en `client_note` ("Etapa: Sin contactar → Contactado") con `auto=true` y el usuario actual como autor.
- [ ] CA9 La ficha de cualquier contacto tiene una pestaña "Seguimiento" que lista las notas (más nueva arriba: fecha, texto, autor; las automáticas se distinguen visualmente). Con `contactos:edit` se pueden agregar (fecha por defecto = hoy AR y texto obligatorio, ≤ 2000 caracteres). Solo el **autor** puede borrar su nota, con `ConfirmButton`. Las notas automáticas (`auto=true`) **no se pueden borrar**, ni siquiera por el admin: el botón no se muestra y `deleteClientNote` lo rechaza en el servidor. Con `view` solo se ven.
- [ ] CA10 Las acciones nuevas empiezan con `checkPermission("contactos")`, validan con zod vía `formToObject`, devuelven `ActionResult` y hacen `revalidatePath("/contactos")` y `revalidatePath("/contactos/<id>")`.
- [ ] CA11 `npm run db:import-potenciales -- <archivo.json>` **simula** por defecto (muestra cuántos crearía, cuántos omite y los nombres omitidos) y solo escribe con `--aplicar`.
- [ ] CA12 Con `--aplicar` inserta los prospectos nuevos con `type='potencial'`, `status='potencial'`, `lead_stage='sin_contactar'` y el mapeo de la sección Datos, más una nota inicial "Importado de la lista de prospectos 2026-09-28" (`auto=true`, `user_id` null) por cada cliente creado.
- [ ] CA13 El script es idempotente: si se corre dos veces, la segunda crea 0 clientes y 0 notas. Un contacto que ya existe (comparando `lower(trim(name))`, p. ej. **Impulsa Mendoza**, que ya es cliente) **no se modifica** y se lista como omitido.
- [ ] CA14 La lógica pura del mapeo JSON → fila (`mapProspect`), de las transiciones de etapa (`stageTransition`) y de la regla de borrado (`canDeleteNote`) tiene tests en Vitest.
- [ ] CA15 `npx tsc --noEmit`, `npm run lint`, `npm test` y `npm run build` pasan.

## Diseño
### Datos
**Constantes:** mover `CLIENT_TYPES` a `src/lib/constants.ts` como `["recurrente", "especial", "potencial"]` y reexportarlo desde `schema.ts`, igual que `COLLECTION_KINDS`. Agregar `LEAD_STAGES = ["sin_contactar", "contactado", "ganado", "perdido"]`, `LEAD_STAGE_LABELS` y `LEAD_PRIORITIES = ["alta", "media", "baja"]`. Revisar los tipos literales `"recurrente" | "especial"` escritos a mano (`badges.tsx`, `ventas/trip-form.tsx`) y reemplazarlos por el tipo derivado.

**Enum `client_type`:** agregar el valor `potencial`. El default de la columna sigue siendo `especial`.

**Enum nuevo `lead_stage`** con los valores de `LEAD_STAGES`.

**`client`** (columnas nuevas, todas nullable):
- `lead_stage lead_stage`: etapa del embudo. Se conserva después de "ganado" como dato de origen.
- `website text`
- `segment text`: segmento comercial (`bodegas_turismo`, `corporativo`, `mineria_industria`, …). Texto libre.
- `lead_priority text`: `alta|media|baja` (validar con `z.enum(LEAD_PRIORITIES)`).

**Tabla nueva `client_note`:**
- `id integer identity PK`
- `client_id integer NOT NULL` → `client.id` **ON DELETE CASCADE**
- `date date NOT NULL` (modo string `YYYY-MM-DD`)
- `text text NOT NULL`
- `auto boolean NOT NULL default false`: la generan el sistema o el script; no se puede borrar.
- `user_id text` → `user.id` ON DELETE SET NULL
- `created_at timestamp NOT NULL default now()`
- Índice `client_note_client_idx (client_id, date)`.

**Migraciones:** se generan **al implementar**, **después** de la de T-001 (driver/vehicle y `driver_id`/`vehicle_id` en trip/expense), que se implementa antes. Hay que partir de un `drizzle/` con la migración de T-001 ya generada y aplicada, y el SQL de T-015 solo debe contener cambios de T-015. Son dos migraciones, porque Postgres no permite usar un valor de enum agregado con `ALTER TYPE … ADD VALUE` dentro de la misma transacción:
1. `npm run db:generate -- --name clientes_potenciales`: enum `lead_stage`, `ADD VALUE 'potencial'` a `client_type`, columnas y `client_note`. Al final agregar:
   ```sql
   UPDATE "client" SET "lead_stage" = 'sin_contactar' WHERE "status" = 'potencial' AND "lead_stage" IS NULL;
   ```
2. `npm run db:generate -- --custom --name clientes_potenciales_tipo`, con:
   ```sql
   UPDATE "client" SET "type" = 'potencial' WHERE "status" = 'potencial';
   ```
Después, `npm run db:migrate`. Antes de ese UPDATE, confirmar con una consulta que ningún cliente con `status='potencial'` tenga recorridos ni tarifas. Si alguno tiene, no pisarle el tipo (agregar `AND NOT EXISTS` sobre `trip`/`rate`) y avisar.

`deleteClient` no cambia: las notas se borran en cascada y no bloquean.

**Mapeo JSON → `client`** (función pura `mapProspect` en `src/lib/prospects.ts`, sin `@/db`):
| JSON | Columna |
|---|---|
| `nombre` (trim) | `name` |
| (fijo) | `type='potencial'`, `status='potencial'`, `lead_stage='sin_contactar'` |
| `contacto.emails[0]` | `email` (solo si es un email válido; si no, `null`) |
| `contacto.whatsapp[0]` ?? `contacto.telefonos[0]` | `phone` |
| `direccion` ?? `ubicacion` | `address` |
| `sitio_web` | `website` |
| `segmento` | `segment` |
| `prioridad` | `lead_priority` |
| el resto | `notes`, en texto con una línea por dato: Rubro, Descripción, Motivo de encaje, Ángulo de venta, Otros emails, Otros teléfonos, WhatsApp, Redes (instagram/facebook/linkedin), Notas del relevamiento, Puntaje/Encaje |
Se ignoran `fuente`, `dominio` y `estado_web`.

### Permisos
- Ver etapa y seguimiento: `contactos:view`.
- Cambiar etapa y agregar notas: `contactos:edit`.
- Borrar una nota: `contactos:edit` **y** ser su autor (`note.user_id === user.id`) **y** que sea `auto=false`. El admin no tiene excepción.
- El script corre por consola con `.env.local` (sin permisos de la app).

### Archivos
- `src/lib/constants.ts`: `CLIENT_TYPES` (movido y con `potencial`), `LEAD_STAGES`, `LEAD_STAGE_LABELS`, `LEAD_PRIORITIES`.
- `src/db/schema.ts`: reexportar `CLIENT_TYPES`, enum `leadStage`, columnas nuevas en `clients` y tabla `clientNotes`.
- `drizzle/XXXX_clientes_potenciales.sql` y `drizzle/XXXX_clientes_potenciales_tipo.sql`: se generan al implementar, después de T-001.
- `src/lib/prospects.ts` (nuevo, puro):
  - `mapProspect(json)` y `normalizeName(s)`.
  - `stageTransition(from, to, type?)`, que devuelve `{ status, leadStage, type, noteText }` o un error. "ganado" exige `recurrente|especial`; "perdido" implica `inactivo`; "sin_contactar"/"contactado" implican `status='potencial'` y `type='potencial'` (sirve para reabrir un perdido).
  - `canDeleteNote(note, userId)`.
- `src/lib/prospects.test.ts` (nuevo): tests del mapeo, de las transiciones (incluida la reapertura de un perdido) y de `canDeleteNote`.
- `src/components/badges.tsx`: `ClientTypeBadge` con "Potencial" y `LeadStageBadge` nuevo.
- `src/app/(app)/contactos/actions.ts`: `changeLeadStage(clientId, formData)` (update del cliente e insert de la nota `auto=true` en un solo `db.batch`), `addClientNote(clientId, formData)` y `deleteClientNote(clientId, noteId)` (verifica autor y `auto=false`). Agregar a `clientSchema` los campos `website`, `segment` y `leadPriority` y la regla de coherencia tipo/estado de CA6. `createClient` con estado potencial pone `lead_stage='sin_contactar'`.
- `src/app/(app)/contactos/client-fields.tsx`: opción Tipo "Potencial" y campos Sitio web, Segmento y Prioridad (NativeSelect). No hace falta que sea cliente dinámico: la coherencia se valida en el servidor, con un hint en el campo.
- `src/app/(app)/contactos/page.tsx`: opción "Potenciales" en el filtro Tipo y filtro/columna Etapa.
- `src/app/(app)/contactos/[id]/page.tsx`: control de etapa en el header (si `lead_stage` no es null), pestaña "Seguimiento" y link al sitio web en "Datos".
- `src/app/(app)/contactos/[id]/lead-stage-control.tsx` (nuevo, cliente): selector de etapa más diálogo "Marcar como ganado" con Tipo obligatorio (solo Recurrente/Especial). Solo `import type` de schema.
- `src/app/(app)/ventas/actions.ts`: `buildTrip` rechaza clientes con `type='potencial'`.
- `src/app/(app)/ventas/trip-form.tsx`: actualizar el tipo `ClientOption` (el filtrado actual ya excluye a los potenciales).
- `scripts/import-potenciales.ts` (nuevo): lee el JSON con la ruta por argumento, usa `mapProspect`, trae los nombres existentes (`lower(trim(name))`), filtra y con `--aplicar` hace `insert … onConflictDoNothing({ target: clients.name }).returning()`. Después inserta las notas iniciales de los clientes del JSON con `type='potencial'` que no tengan ya la nota de importación (`NOT EXISTS` por `client_id` + texto), lo que también cubre reintentos a medias. Imprime el resumen.
- `package.json`: script `"db:import-potenciales": "tsx --env-file=.env.local scripts/import-potenciales.ts"`.
- `specs/MEMORIA.md`: 1–2 líneas sobre el embudo (tipo potencial, etapas, notas `auto`) y el script.

### UI
- Listado: filtro Tipo con "Potenciales" y filtro "Todas las etapas / Sin contactar / Contactados / Ganados / Perdidos".
- Ficha: badges de tipo, estado y etapa. Botón "Cambiar etapa" (FormDialog con NativeSelect). Al elegir "Ganado" aparece "¿Qué tipo de cliente es?" (Recurrente/Especial, obligatorio). Mensajes: "Etapa actualizada" / "¡Cliente ganado! Ahora es un cliente activo" (+ " Cargá su tarifario." si es recurrente).
- Pestaña "Seguimiento": botón "Nueva observación" (Fecha y Observación en Textarea) y tabla Fecha · Observación · Autor · acciones. Las notas automáticas llevan un badge "Automática" y nunca muestran el botón de borrar; en las manuales, el botón aparece solo para el autor. Si está vacía: "Todavía no hay observaciones."

## Plan
- [x] 1. Confirmar que la migración de T-001 ya está generada y aplicada (`drizzle/meta/_journal.json`).
- [x] 2. Constantes (`CLIENT_TYPES` movido, `LEAD_*`) y cambios en `schema.ts`. Corregir los tipos literales.
- [x] 3. Generar las dos migraciones (la normal con el backfill de etapa y la custom con el de tipo), revisar que solo tengan cambios de T-015 y correr `db:migrate`.
- [x] 4. `src/lib/prospects.ts` y sus tests; `npm test`.
- [x] 5. Acciones de contactos (etapa, notas, coherencia de tipo) y `ClientFields`.
- [x] 6. Badges y filtros/columna en `/contactos`.
- [x] 7. Control de etapa y pestaña Seguimiento en `/contactos/[id]`.
- [x] 8. Bloqueo en Ventas (`buildTrip` y tipo en `trip-form`).
- [x] 9. Script `import-potenciales` y entrada en `package.json`. Correr en simulación, revisar los omitidos (esperado: Impulsa Mendoza) y después `--aplicar`. Correr `--aplicar` otra vez y confirmar 0/0.
- [x] 10. Actualizar MEMORIA.md y hacer la verificación completa.

## Verificación
- `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build`
- Script: la simulación muestra "crearía 29, omite 1 (Impulsa Mendoza)" o lo que corresponda según la base. `--aplicar` crea esos N con tipo y estado Potencial y etapa Sin contactar; la segunda corrida da 0 creados y 0 notas. La ficha de Impulsa Mendoza no cambia.
- Manual, con datos de prueba que después se **borran** (la base es producción): crear el contacto "ZZ Prueba T-015" con Estado Potencial y Tipo Especial (error de coherencia); con Tipo Potencial se crea en "Sin contactar". Después:
  1. Verificar que no aparece en Ventas → Nuevo recorrido.
  2. Agregar una nota manual y pasarlo a Contactado: se agrega la nota automática, sin botón de borrar.
  3. Pasarlo a Perdido (queda inactivo) y reabrirlo a Contactado (vuelve a potencial).
  4. Pasarlo a Ganado sin tipo (error) y con Especial (queda activo y especial); ahora sí aparece en Ventas.
  5. Con otro usuario con `edit`, verificar que no puede borrar la nota manual; con el autor, sí.
  6. Eliminar el contacto (sus notas se borran en cascada).
  Con un usuario `view` no se ven los controles de edición.

## Fuera de alcance
- Recordatorios o tareas con vencimiento ("volver a llamar el jueves").
- Envío de mails o WhatsApp desde el ERP y plantillas.
- Tabla de múltiples contactos o emails por cliente (se guardan en `notes`).
- Tablero kanban con arrastrar y soltar.
- Métricas del embudo en el dashboard (T-014 o una tarea aparte).
- Editar notas (solo agregar y borrar las propias).

## Preguntas abiertas
Resueltas por el usuario el 2026-09-28:
- "Perdido" pasa a `status='inactivo'`.
- Las notas las borra solo su autor; las automáticas (cambio de etapa e importación) no se pueden borrar.
- Mientras son prospectos, conservan el tipo `potencial` (valor nuevo en `CLIENT_TYPES`, que antes no lo tenía); recurrente o especial se elige al pasar a Ganado.

---

## Notas de implementación
- **Migraciones** (después de `0003_flota`): `drizzle/0004_clientes_potenciales.sql` (enum `lead_stage`, `ADD VALUE 'potencial'`, 4 columnas nullables, `client_note` con FK cascade/set null e índice, + backfill de etapa) y `drizzle/0005_clientes_potenciales_tipo.sql` (custom, backfill de tipo). Se aplicaron **por separado** (`db:migrate` tras generar cada una), porque drizzle-kit corre las pendientes en una sola transacción. Consulta previa: no había clientes con `status='potencial'` (0 filas afectadas por los backfills).
- **Importación**: simulación "crearía 29, omite 1 (Impulsa Mendoza)"; `--aplicar` creó 29 clientes y 29 notas iniciales; segunda corrida 0/0. Impulsa Mendoza sin cambios (`updated_at` igual).
- `CLIENT_TYPES` movido a `constants.ts` (+ `ClientType`, `CLIENT_TYPE_LABELS`, `LEAD_STAGES`, `LEAD_STAGE_LABELS`, `LEAD_PRIORITIES`, `LEAD_PRIORITY_LABELS`); `schema.ts` reexporta `CLIENT_TYPES` y `LEAD_STAGES`.
- `src/lib/prospects.ts` suma `formLeadStage(type, status, current)` (coherencia CA6 del formulario, testeada): potencial+activo → error; estado potencial con tipo ≠ potencial → error; potencial+inactivo → `perdido`; salir del embudo desde el formulario (tipo recurrente/especial) → `ganado`. `updateClient` agrega nota automática si la etapa cambió.
- **Decisión**: desde "Ganado" no se puede cambiar de etapa (`stageTransition` lo rechaza y la ficha no muestra el control; el badge sí). Mantiene el invariante tipo potencial ⇔ embudo y evita bloquear recorridos de un cliente ya ganado.
- **Desvío**: `saveRateVersion` convierte a recurrente solo si el tipo **no** es `potencial` (un potencial con tarifario cotizado elige su tipo al marcarlo como ganado); si no, rompía CA6.
- Listado: el filtro Etapa y la columna aparecen con Estado = Potenciales **o** Tipo = Potenciales; con una etapa elegida se filtra por `lead_stage` e ignora el estado (así "Perdidos", que son inactivos, aparecen).
- Ficha: pestaña por defecto "Seguimiento" para potenciales; autor = `coalesce(name, username, email)`, notas del script muestran "Sistema". Sitio web se muestra como link (agrega `https://` si falta); también Segmento y Prioridad en "Datos". El input de sitio web es texto (`inputMode="url"`) para no bloquear URLs sin protocolo.
- Verificación manual en la base: alta/borrado de "PRUEBA T-015" con nota → cascada OK (borrado). La prueba por navegador de la lista de Verificación queda para el revisor/usuario.
- Archivos: `src/lib/{constants,prospects,prospects.test}.ts`, `src/db/schema.ts`, `drizzle/0004*`, `drizzle/0005*`, `drizzle/meta/*`, `src/components/badges.tsx`, `src/app/(app)/contactos/{actions.ts,client-fields.tsx,page.tsx}`, `src/app/(app)/contactos/[id]/{page.tsx,lead-stage-control.tsx}`, `src/app/(app)/ventas/{actions.ts,trip-form.tsx}`, `scripts/import-potenciales.ts`, `package.json`, `specs/MEMORIA.md`.
- `tsc`, `lint`, `test` (54 ok) y `build` pasan.
- **Arreglo posterior (hallazgo `contactos/actions.ts:70`)**: `formLeadStage` recibe `hasTrips` y rechaza el tipo Potencial con "No se puede pasar a Potencial un cliente que ya tiene recorridos."; `updateClient` cuenta los recorridos del cliente en el servidor. **Decisión**: no se cuentan las tarifas (a diferencia del criterio de 0005) porque un potencial puede tener un tarifario cotizado (desvío de `saveRateVersion`) y bloquearlo le impediría editar su ficha. Test nuevo en `prospects.test.ts` (55 ok).

## Revisión
Veredicto: **APROBADO**
- Criterios: CA1–CA15 ✅ (CA6 con el desvío en `saveRateVersion`, que se acepta).
- [MENOR] `contactos/actions.ts:70` + `lib/prospects.ts:45-48`: un cliente que ya tiene recorridos se puede pasar a Potencial, y `buildTrip` le bloquea la edición de esos recorridos.
- [MENOR] `contactos/page.tsx:34-36`: con Tipo=Potenciales y Etapa=Ganados la lista sale siempre vacía (inocuo).
- [MENOR] `import-potenciales.ts:49-58`: agrega la nota a un potencial que ya existía si el nombre coincide exacto. No pasó en producción.
- [MENOR] `0005_*.sql`: el backfill no tiene guard sobre trip/rate. Se verificó que afectaba 0 filas.
- Verificado: el servidor solo deja borrar notas manuales a su autor; permisos; `db.batch`; el script es idempotente; se revisaron los arreglos de T-001.
