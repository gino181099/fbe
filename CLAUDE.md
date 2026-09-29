@AGENTS.md

# Frabel ERP

ERP de Frabel (transporte de pasajeros, Mendoza). UI y textos en **español rioplatense**, montos en ARS.
Módulos: Contactos (clientes + tarifarios versionados), Ventas (recorridos), Finanzas (cuentas corrientes, cobros, gastos, combustible, PDF de estado de cuenta), Usuarios (permisos por módulo).

## Flujo de trabajo (spec-driven)

- Backlog: `specs/TAREAS.md` · Specs: `specs/T-XXX-*.md` (plantilla `specs/_plantilla.md`)
- Conocimiento estable (reglas de negocio, decisiones, trampas): `specs/MEMORIA.md` — **leer antes de explorar código**
- Registro de lo hecho: `specs/REGISTRO.md` (más nuevo arriba)
- Comandos: `/tareas [IDs|auto|commit]` corre el arnés · `/nueva-tarea <texto>` · `/recomendar`
- Subagentes: `especificador` (escribe specs y recomendaciones), `implementador` (ejecuta una spec aprobada), `revisor` (revisa el diff contra la spec)

## Stack y comandos

Next.js 16 App Router + Server Actions · Neon Postgres + Drizzle · Auth.js v5 (Google + credenciales, JWT) · Tailwind 4 + shadcn/ui (radix) · react-pdf.

```
npm run dev | build | lint          npx tsc --noEmit        npm test | npm run test:watch
npm run db:generate -- --name x     npm run db:migrate      npm run db:studio
npm run db:seed-admin               npm run db:import-legacy -- <archivo sqlite>
```
Variables en `.env.local` (ver `.env.example`). Tests con Vitest (`src/**/*.test.ts`) solo sobre lógica pura (sin `@/db` ni `server-only`); no usan la base.

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
scripts/                  seed-admin.ts, migrate-legacy.ts      drizzle/  migraciones SQL
```

## Convenciones (seguirlas siempre)

- **Server actions**: primera línea `const { error } = await checkPermission("<módulo>")`; validar con zod vía `formToObject`; devolver `ActionResult` (`{ok:true,message}` | `{ok:false,error}`); `revalidatePath` de las rutas afectadas.
- **Páginas**: `await requirePermission("<módulo>")`; ocultar controles de edición con `can(user, módulo, "edit")`.
- Filtros por `searchParams` (form GET); tablas server-rendered; formularios en `FormDialog`; borrar con `ConfirmButton`.
- Fechas `date` en modo string `YYYY-MM-DD` (nunca `Date` para días). Montos `numeric(14,2)` modo number; parsear siempre con `parseAmount` (entiende "50.000" y "1.500,50").
- Componentes cliente **no** importan valores de `@/db/schema` (solo `import type`); constantes compartidas en `src/lib/constants.ts`.
- Selects: `NativeSelect` de shadcn. Cambios de esquema: editar `schema.ts` → `db:generate` → `db:migrate` (backfills de datos dentro del SQL de la migración).

## Trampas conocidas

- Next 16: `middleware` ahora es `src/proxy.ts`; `params`/`searchParams` son Promises; ante dudas leer `node_modules/next/dist/docs/` (solo el archivo puntual).
- React 19 resetea formularios tras una acción: para que muestren valores nuevos usar `key` derivada de los datos.
- `neon-http` no tiene transacciones interactivas: usar `db.batch([...])`.
- `tsx` no puede cargar `@react-pdf/renderer` (ESM); probar el PDF desde la app.
- En Windows, heredocs con comillas/backticks fallan en Bash: editar archivos con Edit/Write.
- Nunca subir `frabel-database*` ni `.env*` (ya están en `.gitignore`). La base de Neon es **producción**: datos de prueba se crean y se borran.

## Uso eficiente de tokens

1. Empezar por `specs/MEMORIA.md` y la spec de la tarea; no releer archivos ya resumidos ahí.
2. Buscar con Grep/Glob acotado a una ruta; leer archivos con `offset/limit` cuando son largos.
3. Subagentes devuelven resúmenes cortos (≤ 15 líneas); el orquestador no repite su trabajo.
4. Al aprender algo no obvio, agregarlo a `specs/MEMORIA.md` (1–2 líneas) para no redescubrirlo.
