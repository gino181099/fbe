# Frabel ERP

ERP de Frabel (transporte de pasajeros). Corre en **Vercel** (aplicación) con la base en **Neon** (Postgres); se entra desde cualquier navegador.

| Módulo | Qué hace |
| --- | --- |
| **Contactos** | Clientes actuales y potenciales. *Recurrentes* (con tarifario por recorrido y capacidad) o *especiales* (servicios puntuales). Tarifario con historial de versiones y carga desde Excel/CSV. |
| **Leads** | Oportunidades comerciales (CRM). |
| **Ventas** | Recorridos realizados. Para clientes recurrentes el precio sale solo de la tarifa vigente en la fecha del viaje. |
| **Finanzas** | Cuentas corrientes, cobros, recibos, comprobantes, gastos, combustible, proveedores y PDFs. |

Stack: Next.js 16 · Postgres en Neon + Drizzle ORM (`node-postgres`) · Auth.js v5 (clave única) · Tailwind + shadcn/ui · react-pdf.

## Configuración

Tres variables de entorno (ver `.env.example`): `DATABASE_URL` (Neon, URL "-pooler"), `ACCESS_PASSWORD` (clave única para entrar) y `AUTH_SECRET` (firma de las sesiones). En esta PC van en `.env.local` (no se sube); en producción, en Vercel → Settings → Environment Variables.

## Producción (Vercel + Neon)

- El proyecto de Vercel está conectado al repo de Bitbucket: cada `git push` a `main` despliega solo. Región `gru1` (São Paulo, `vercel.json`), junto a la base de Neon (sa-east-1).
- **Backups:** `npm run db:backup` guarda una copia en `backups/` (los últimos 60, fuera de git); también se descarga desde el menú (usuarios de `DB_DOWNLOAD_USERS`). Restaurar: `npm run db:restore -- "<archivo>"` (reemplaza todo; antes guarda backup). Neon además guarda historial propio (restauración a un momento dado desde su panel).

## Desarrollo (esta PC)

```bash
npm install
npm run dev          # next dev en http://localhost:3000
```

**Ojo:** `.env.local` apunta a la base real de Neon. Para probar sin tocar datos reales, crear un branch en Neon y poner su URL en `.env.local`.

Otros comandos: `npm run db:studio` (explorador visual).

### Cambios en la base de datos

1. Editar `src/db/schema.ts`.
2. `npm run db:generate -- --name descripcion-del-cambio` (genera el SQL en `drizzle/`).
3. `npm run db:migrate` (aplica las migraciones en la base de `DATABASE_URL`, o sea Neon). Hacerlo **antes** del `git push` que despliega el código nuevo.

### Publicar cambios

`git push` al repo de Bitbucket: Vercel compila y publica.

## Importar la base anterior (SQLite)

```bash
npm run db:import-legacy -- ruta/al/frabel-database
```

Idempotente: solo agrega lo que falta. El archivo `frabel-database` está en `.gitignore`.

## Estructura

```
src/
  app/(auth)/          login (clave única)
  app/(app)/           módulos + inicio
  app/api/             Auth.js y PDFs
  db/                  conexión (node-postgres) y schema.ts
  lib/config.ts        variables de entorno (base, clave, firma)
  lib/permissions.ts   usuario actual y permisos
scripts/               datos.ts (backup/restore), importaciones
drizzle/               migraciones SQL
```
