# T-011 · Solución de errores (estado de cuenta de Impulsa Mendoza)

- Estado: Implementada <!-- Borrador → Aprobada → Implementada -->
- Prioridad: Alta
- Fecha: 2026-09-28
- Tarea: `specs/TAREAS.md` → T-011

## Contexto
Al abrir `/finanzas/cuentas/8` (estado de cuenta del cliente que figura como "Impulsar") en `npm run dev` aparece
"Runtime Error: Jest worker encountered 2 child process exceptions, exceeding retry limit". El usuario dice además que
"ciertas partes del sitio no funcionan". Y el cliente está mal nombrado: es **Impulsa Mendoza**, no "Impulsar".

### Diagnóstico (del especificador)
- El código de la página y de `getStatement` (`src/lib/balances.ts`) **no** muestra un problema de serialización:
  a los componentes cliente (`FormDialog`, `CollectionFields` vía `children`) solo llegan strings/números y la server
  action `saveCollection.bind(null, null)`. `data.client` (que tiene `createdAt`/`updatedAt` como `Date`) solo se usa
  en el server. Fechas son string, montos number. No hay recursión.
- Ese mensaje **no sale del render**: sale del `jest-worker` que Next levanta **solo en dev** para cada ruta dinámica
  del App Router (`node_modules/next/dist/server/base-server.js` ~l.1427 → `next-dev-server.js` `getStaticPaths()` ~l.568,
  que forkea `static-paths-worker` con `maxRetries: 1` → "2 child process exceptions"). El worker es un proceso Node aparte
  que carga el módulo de la página para buscar `generateStaticParams`; si ese proceso **muere** (no un throw normal),
  aparece este error genérico.
- Por lo tanto la causa probable **no es el cliente 8**: debería fallar en **todas las rutas dinámicas** en dev:
  `/finanzas/cuentas/[id]`, `/contactos/[id]` y `/api/estado-cuenta/[clientId]` (esto explicaría "ciertas partes del sitio").
- Sospechosos del crash del worker (a confirmar con el log real, que el worker escribe en la **terminal** de `npm run dev`,
  no en el overlay del navegador):
  1. El worker no ve `DATABASE_URL` u otra env → `src/db/index.ts` hace `throw` a nivel módulo al importarse.
  2. Problema de entorno Windows/OneDrive (proyecto dentro de `OneDrive\...`: bloqueo/sincronización de `.next/`), caché
     `.next` corrupta, o `NODE_OPTIONS` raro que rompe el fork.
  3. Bug de la versión `next@16.3.6` con Turbopack en Windows (existe un patch más nuevo).
  4. Algún import del grafo de la página que no puede cargarse fuera del proceso principal (p. ej. `server-only`, `next-auth`).

## Objetivo
Que el estado de cuenta de cualquier cliente (y el resto de las páginas dinámicas) abra sin error en dev y en build de
producción, y que el cliente se llame "Impulsa Mendoza" sin que una futura re-importación lo vuelva a crear como "Impulsar".

## Criterios de aceptación
- [x] CA1 La causa real del error queda identificada con el log de la terminal y anotada en "Notas de implementación" (texto del error + archivo/línea).
- [x] CA2 `/finanzas/cuentas/8` abre en `npm run dev` sin error, mostrando tabla, saldos y botón "Descargar PDF".
- [x] CA3 Se abren sin error al menos otras 3 cuentas (incluir Viajes Conocer, Huentata y Particular) y un rango `?desde=…&hasta=…` que abarque todo el historial.
- [x] CA4 `/contactos/[id]` (un recurrente y un especial) y `/api/estado-cuenta/8` (descarga del PDF) funcionan en dev.
- [x] CA5 Recorrida completa en dev (ver Plan paso 5) sin "Runtime Error" en overlay ni errores en la terminal; cualquier otro error encontrado se corrige si es chico o se registra como tarea nueva en `specs/TAREAS.md`.
- [x] CA6 `npm run build` + `npm start`: las mismas URLs de CA2–CA4 funcionan (confirma que producción/Vercel no está afectada o queda corregida).
- [x] CA7 El cliente id 8 se llama "Impulsa Mendoza" (se ve así en Contactos, Finanzas, estado de cuenta y PDF); sus recorridos y cobros siguen asociados (mismo `client_id`, mismo saldo que antes del cambio).
- [x] CA8 `scripts/migrate-legacy.ts` mapea "Impulsar" → "Impulsa Mendoza" (agencias **y** clientes especiales), así re-importar no crea un cliente "Impulsar" vacío.
- [x] CA9 `npx tsc --noEmit` y `npm run lint` sin errores nuevos.

## Diseño
### Datos
Sin cambios de esquema. Un solo cambio de **dato** en producción: `client.name` del id 8 → "Impulsa Mendoza".
Hacerlo desde la UI (Contactos → cliente → Editar, usa `updateClient` en `src/app/(app)/contactos/actions.ts`), que ya
valida y revalida. **Antes**: verificar en `npm run db:studio` que no exista otro cliente "Impulsa Mendoza" (el nombre es
`unique`); si existiera, **no** fusionar sin consultar al usuario (ver Preguntas abiertas). No hace falta script ni migración.
### Permisos
Sin cambios (`finanzas` view para ver la cuenta; `contactos` edit para renombrar).
### Archivos
- `scripts/migrate-legacy.ts` — `AGENCY_NAMES` agrega `Impulsar: "Impulsa Mendoza"`; aplicar el mismo mapeo al nombre de clientes especiales (`clean(r.Cliente)` en el Set `special` **y** donde se resuelve el `clientId` de cada `Servicio_Especial`).
- Según la causa hallada (solo lo necesario), p. ej.: `src/db/index.ts`, `next.config.ts`, `package.json` (bump de `next` a último 16.x patch), o nada de código si era caché/entorno.
- `specs/MEMORIA.md` — 1–2 líneas: causa del error de jest-worker y cómo se resolvió; "Impulsar" en la base vieja = "Impulsa Mendoza".
### UI
Sin cambios de UI.

## Plan
- [x] 1. Reproducir: `npm run dev`, abrir `/finanzas/cuentas/8` y copiar **el log de la terminal** (el worker imprime ahí su stderr: buscar el stack real antes del mensaje de jest-worker). Probar también `/finanzas/cuentas/<id de Viajes Conocer>` y `/contactos/8` para confirmar si falla toda ruta dinámica.
- [x] 2. Descartar entorno, en este orden, reprobando después de cada uno: (a) cortar el dev server, borrar `.next/` y relanzar; (b) confirmar que `.env.local` tiene `DATABASE_URL` y que no hay `NODE_OPTIONS` seteado en la terminal; (c) pausar la sincronización de OneDrive o probar `npm run dev -- --webpack` para aislar Turbopack.
- [x] 3. Aplicar el fix mínimo según la causa: si es la env → asegurar que se carga (no mover el `throw` a un lugar que oculte errores reales); si es bug de Next → `npm i next@<último 16.x>` (y `eslint-config-next` a la misma versión) y reprobar; si es un import que no carga en el worker → aislarlo. Si nada lo resuelve, documentar la causa y dejar el workaround en MEMORIA (no agregar `generateStaticParams` falsos ni hacks sin entender la causa).
- [x] 4. Verificar CA2–CA4 (varias cuentas, rango completo, PDF, contactos).
- [x] 5. Recorrida en dev, con usuario admin, anotando cualquier error de overlay/terminal: `/`, `/contactos`, `/contactos/[id]` (recurrente y especial), abrir diálogo de nueva versión de tarifario (sin guardar), `/ventas` con filtros, `/finanzas` y sus solapas/filtros, `/finanzas/cuentas/[id]`, descarga de PDF, `/usuarios`, `/login` (en ventana privada) y `/sin-acceso`/`/pendiente`. Abrir diálogos de alta/edición sin guardar. Si se crea algo para probar, **borrarlo**.
- [x] 6. Renombrar el cliente 8 a "Impulsa Mendoza" desde Contactos (verificar antes unicidad en `db:studio`); anotar el saldo antes y confirmar que es el mismo después.
- [x] 7. Editar `scripts/migrate-legacy.ts` (mapeo "Impulsar"). **No** correr la importación contra producción.
- [x] 8. `npx tsc --noEmit`, `npm run lint`, `npm run build` + `npm start` y reprobar CA2–CA4 (CA6).
- [x] 9. Actualizar `specs/MEMORIA.md` y "Notas de implementación".

## Verificación
- `npx tsc --noEmit` · `npm run lint` · `npm run build`
- Manual: pasos 1, 4, 5 y 8 del Plan. La base es producción: no crear datos salvo que haga falta y borrarlos al terminar.

## Fuera de alcance
- Arreglos grandes que aparezcan en la recorrida (paso 5): se registran como tareas nuevas en `specs/TAREAS.md`.
- Fusionar clientes duplicados, cambios de esquema, tests automáticos (T-012).
- Re-ejecutar la importación legacy.

## Preguntas abiertas
- (No bloqueante) Si ya existiera un cliente "Impulsa Mendoza" aparte del id 8, ¿se fusionan? El implementador debe frenar y consultar en ese caso.
- (No bloqueante) ¿El error también aparece en el sitio publicado en Vercel? Si solo pasa en local (lo esperable), se confirma que es del entorno de dev.

---

## Notas de implementación
- **Causa (CA1)**: no era código ni el cliente 8. Log `.next/dev/logs/next-development.log` del dev server viejo (PID 7092):
  `⨯ Failed to generate static paths for /contactos/[id]:` / `/finanzas/cuentas/[id]:` → `Error: Jest worker encountered 2 child
  process exceptions, exceeding retry limit` (origen `next/dist/server/dev/next-dev-server.js` l.115–134 `getStaticPathsWorker`,
  llamado desde `getStaticPaths` l.574), más varios `⨯ "uncaughtException:" Error: write EPIPE`. Fallaba **toda ruta dinámica**
  (contactos/[id], finanzas/cuentas/[id]). Ese server había sido lanzado desde un Git Bash (`bash → npm run dev`) cuya salida ya no
  tenía lector: el worker de static paths se forkea con stdout/stderr "pipeados" a `process.stdout` del server, y con esa salida
  rota (EPIPE) el proceso hijo moría → error genérico de jest-worker. El stack del hijo no quedó registrado (se escribe solo en la
  terminal, que era justamente la rota). Pruebas que lo confirman: el mismo `loadStaticPaths` corrido a mano con jest-worker contra
  el build de dev devolvió `{"fallbackMode":"BLOCKING_STATIC_RENDER"}` sin error (con `DATABASE_URL`; sin ella da un throw normal,
  no un crash), y tras matar el server (`taskkill /T`), borrar `.next/` y relanzar `npm run dev` **todas** las rutas respondieron 200.
- **Fix**: sin cambios de código de la app (plan paso 2a: cortar server + borrar `.next` + relanzar). No se tocó `next`, `next.config.ts`
  ni `src/db/index.ts`. No se probó 2c (OneDrive/`--webpack`) porque 2a ya lo resolvió.
- **Recorrida dev (CA2–CA5)**, todo 200 y sin errores en terminal ni consola: `/`, `/contactos` (+filtros), `/contactos/1`, `/3`, `/8`,
  `/37`, `/contactos/99999` (404 esperado), `/ventas` (+desde/hasta/cliente/chofer/pagina), `/finanzas` (+`todos=1`), `/finanzas/cobros`
  (+filtros), `/finanzas/gastos` (+filtros), `/finanzas/cuentas/{8,1,37,3}` y rangos `desde=2000-01-01&hasta=2030-12-31` (8 y 1),
  `/api/estado-cuenta/8` y `/1` (PDF descargado), `/usuarios`, `/sin-acceso`, `/pendiente` y `/login` (redirigen a `/` con sesión, OK).
  Diálogos abiertos sin guardar: Editar contacto, Nueva versión del tarifario, Nuevo recorrido, Registrar cobro. `/login` en ventana
  privada no se probó (no se pudo generar sesión/ventana aparte desde el agente). Observación (no error): `/finanzas/gastos` tarda
  3–5 s en dev.
- **Rename (CA7)**: antes se verificó por SQL de solo lectura que no hubiera otro cliente `ilike '%impuls%'` (solo id 8). Renombrado desde
  Contactos → Editar. Antes y después: 1 recorrido, $1.400.000 facturado, 0 cobros, saldo $1.400.000, mismo `client_id` 8. Se ve
  "Impulsa Mendoza" en Contactos, Finanzas, estado de cuenta y nombre del PDF. El detalle del recorrido sigue diciendo "Impulsar"
  porque es el nombre del recorrido importado (catálogo/`route_text` de la base vieja), no el del cliente; no se tocó.
- **CA8**: `scripts/migrate-legacy.ts` — `AGENCY_NAMES` suma `Impulsar: "Impulsa Mendoza"` y nuevo helper `specialClientName`
  (mapeo + "-"/null → "Particular") usado en el Set `special` y en el `clientId` de cada `Servicio_Especial`. No se corrió la importación.
- **CA6**: `npm run build` OK; `npm start` → cuentas 8, 1 (rango completo), 37, 3, contactos 1 y 8, `/finanzas` y PDF de 8 OK.
- CA9: `npx tsc --noEmit` y `npm run lint` sin errores.
- Archivos: `scripts/migrate-legacy.ts`, `specs/MEMORIA.md`, esta spec. Dato: `client.name` id 8.

## Revisión
**Veredicto: APROBADO** (2026-09-28)
- Criterios CA1–CA9 ✅ (CA2–CA7 son manuales/datos de producción: tomados del informe del implementador).
- Código: solo `scripts/migrate-legacy.ts` (mapeo `Impulsar → Impulsa Mendoza` en `AGENCY_NAMES` + `specialClientName`, usado en el Set `special` y en el `clientId` de `Servicio_Especial`); preserva el comportamiento previo. `specs/MEMORIA.md` l.20 y l.36.
- Hallazgos: 1) [MENOR] `/login` sin sesión (ventana privada) no se probó → prueba manual del usuario. 2) [MENOR] el detalle del recorrido del cliente 8 sigue diciendo "Impulsar" (viene de `route_text`/catálogo importado), fuera de alcance.
- tsc / lint: OK.
