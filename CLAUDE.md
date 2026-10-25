@AGENTS.md

# Frabel ERP

ERP de Frabel (transporte de pasajeros, Mendoza). UI y textos en **español rioplatense**, montos en ARS.
Módulos: Agenda (actividades por usuario), Contactos (clientes + tarifarios versionados), Leads, Ventas (recorridos), Flota, Finanzas (cuentas corrientes, recibos, comprobantes, gastos, combustible, proveedores, PDFs). 4 usuarios con clave única; auditoría creado/modificado por.

## Flujo de trabajo

- Conocimiento estable (reglas de negocio, decisiones, trampas): `specs/MEMORIA.md` — **leer antes de explorar código**
- Backlog: `specs/TAREAS.md` · Registro de lo hecho: `specs/REGISTRO.md` (más nuevo arriba) · Checklist de calidad: `specs/CHECKLIST.md`
- **Arnés spec-driven DESACTIVADO** (2026-10-20, por costo): los comandos `/tareas`, `/nueva-tarea`, `/recomendar` y los subagentes `especificador`/`implementador`/`revisor` están guardados en `.claude/_desactivado/`. No usarlos ni imitarlos: trabajar directo en la sesión. Para reactivarlo, volver a mover `commands/` y `agents/` a `.claude/`.

## Stack y comandos

Next.js 16 App Router + Server Actions · **Postgres 18 local** (binarios por npm) + Drizzle `node-postgres` · Auth.js v5 (clave única, JWT) · Tailwind 4 + shadcn/ui (radix) · react-pdf.
Corre 100% local: una PC de la oficina es el servidor (`instalar.bat` / `iniciar-erp.bat` / `actualizar.bat`, git pull desde Bitbucket).

```
npm run dev | build | start | lint  npx tsc --noEmit        npm test | npm run test:watch
npm run db:start | db:stop | db:status | db:setup         npm run db:backup | db:restore -- <archivo>
npm run db:generate -- --name x     npm run db:migrate      npm run db:studio
npm run db:import-legacy -- <archivo sqlite>
```
`dev`/`start` levantan Postgres solos. Config fija en `src/lib/config.ts` (sin `.env` obligatorio). Tests con Vitest (`src/**/*.test.ts`) solo sobre lógica pura (sin `@/db` ni `server-only`); no usan la base.

## Mapa del código

```
src/db/schema.ts          todas las tablas + enums (MODULES, LEVELS, CLIENT_TYPES, EXPENSE_CATEGORIES)
src/lib/permissions.ts    getCurrentUser (cache por request), can(), requirePermission() páginas, checkPermission() acciones
src/lib/rates.ts          findRate, ratesInForce, applyNewRates (versiona tarifas), recalculateTripPrices
src/lib/balances.ts       getBalances (saldo por cliente), getStatement (estado de cuenta), sumOf
src/lib/forms.ts          formToObject, zMoney/zDate/zText, firstError   · parse-amount.ts (formato AR)
src/lib/format.ts         formatMoney, formatDate, today (zona AR)     · constants.ts (seguro para cliente)
src/components/           form-dialog, confirm-button, page-header (PageHeader, Field, StatCard, EmptyState), app-sidebar
src/app/(auth)/           login, pendiente, sin-acceso + actions (login/logout)
src/app/(app)/<módulo>/   page.tsx (server) + actions.ts ("use server") + formularios cliente
src/app/api/estado-cuenta/[clientId]/route.tsx   PDF
src/proxy.ts              (ex middleware) solo redirige sin sesión a /login
src/lib/config.ts         clave única, AUTH_SECRET, puerto/carpetas/URL de la base
src/lib/audit.ts          created()/updated() para las acciones, getUsers/getUserNames   · components/audit-info.tsx
src/lib/activities.ts     consultas de la agenda   · components/activity-{fields,list}.tsx, activities-panel.tsx
scripts/                  db.ts (Postgres local) · local.ts (arranque) · datos.ts (backup/restore) · migrate-legacy.ts      drizzle/  migraciones SQL
```

## Convenciones (seguirlas siempre)

- **Server actions**: primera línea `const { user, error } = await checkPermission("<módulo>")` (agenda: `checkUser()`); altas con `...created(user.id)` y ediciones con `...updated(user.id)`; validar con zod vía `formToObject`; devolver `ActionResult` (`{ok:true,message}` | `{ok:false,error}`); `revalidatePath` de las rutas afectadas.
- **Páginas**: `await requirePermission("<módulo>")`; ocultar controles de edición con `can(user, módulo, "edit")`.
- Filtros por `searchParams` (form GET); tablas server-rendered; formularios en `FormDialog`; borrar con `ConfirmButton`.
- Fechas `date` en modo string `YYYY-MM-DD` (nunca `Date` para días). Montos `numeric(14,2)` modo number; parsear siempre con `parseAmount` (entiende "50.000" y "1.500,50").
- Componentes cliente **no** importan valores de `@/db/schema` (solo `import type`); constantes compartidas en `src/lib/constants.ts`.
- Selects: `NativeSelect` de shadcn. Cambios de esquema: editar `schema.ts` → `db:generate` → `db:migrate` (backfills de datos dentro del SQL de la migración).

## Trampas conocidas

- Next 16: `middleware` ahora es `src/proxy.ts`; `params`/`searchParams` son Promises; ante dudas leer `node_modules/next/dist/docs/` (solo el archivo puntual).
- React 19 resetea formularios tras una acción: para que muestren valores nuevos usar `key` derivada de los datos.
- Varias escrituras juntas: `db.transaction(async (tx) => { ... })` (no hay `db.batch`, eso era de Neon).
- `tsx` no puede cargar `@react-pdf/renderer` (ESM); probar el PDF desde la app.
- En Windows, heredocs con comillas/backticks fallan en Bash: editar archivos con Edit/Write.
- Nunca subir `frabel-database*` ni `.env*` (ya están en `.gitignore`). La base local de esta PC tiene datos reales copiados (la de producción es la de la PC de la oficina): datos de prueba se crean y se borran. Los datos de Postgres viven en `C:\FrabelERP-datos` (fuera del repo y de OneDrive). Los cambios de código **no** llevan datos: la base válida es la de producción. `datos-iniciales/` es solo para la primera instalación.

## Uso eficiente de tokens

1. Empezar por `specs/MEMORIA.md` y la spec de la tarea; no releer archivos ya resumidos ahí.
2. Buscar con Grep/Glob acotado a una ruta; leer archivos con `offset/limit` cuando son largos.
3. Subagentes devuelven resúmenes cortos (≤ 15 líneas); el orquestador no repite su trabajo.
4. Al aprender algo no obvio, agregarlo a `specs/MEMORIA.md` (1–2 líneas) para no redescubrirlo.
