# Frabel ERP

ERP de Frabel (transporte de pasajeros). Primera etapa: **CRM**.

| Módulo | Qué hace |
| --- | --- |
| **Contactos** | Clientes actuales y potenciales. *Recurrentes* (con tarifario por recorrido y capacidad) o *especiales* (servicios puntuales). Tarifario con historial de versiones y carga desde Excel/CSV. |
| **Ventas** | Recorridos realizados. Para clientes recurrentes el precio sale solo de la tarifa vigente en la fecha del viaje. |
| **Finanzas** | Cuentas corrientes (facturado − cobrado), cobros, gastos, control de combustible por estación y **estado de cuenta en PDF** por cliente. |
| **Usuarios** | El admin habilita a quienes ingresan con Google y les asigna permisos por módulo (sin acceso / ver / ver y editar). |

Stack: Next.js 16 (App Router, Server Actions) · Neon Postgres + Drizzle ORM · Auth.js v5 (Google + usuario/contraseña) · Tailwind + shadcn/ui · react-pdf.

## Puesta en marcha local

Requisitos: Node 22 o superior.

```bash
npm install
cp .env.example .env.local   # completar las variables (ver abajo)
npm run db:migrate           # crea/actualiza las tablas en Neon
npm run db:seed-admin        # crea el usuario admin
npm run dev                  # http://localhost:3000
```

### Variables de entorno

| Variable | Dónde se obtiene |
| --- | --- |
| `DATABASE_URL` | Neon → proyecto → *Connect* → connection string **pooled** |
| `AUTH_SECRET` | `npx auth secret` (o cualquier texto aleatorio largo) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud Console (ver abajo). Si están vacías, el login muestra solo usuario y contraseña. |

### Login con Google

1. [Google Cloud Console](https://console.cloud.google.com/) → *APIs y servicios* → *Pantalla de consentimiento OAuth*: tipo *Externo*, nombre "Frabel ERP".
2. *Credenciales* → *Crear credenciales* → *ID de cliente OAuth* → *Aplicación web*.
3. *URIs de redireccionamiento autorizados*:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://TU-DOMINIO.vercel.app/api/auth/callback/google`
4. Copiar el ID y el secreto a `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`.

Quien entra con Google por primera vez queda **pendiente** hasta que el admin lo active en *Usuarios*.

### Usuario administrador

`npm run db:seed-admin` crea (o reactiva) el usuario `frabel` con acceso total. Para cambiarle la contraseña:

```bash
ADMIN_PASSWORD='nueva-clave' npm run db:seed-admin
```

## Importar la base anterior (SQLite)

```bash
npm run db:import-legacy -- ruta/al/frabel-database
```

Es idempotente: se puede correr de nuevo con una copia más nueva de la base y solo agrega lo que falta, sin pisar lo que se editó en el ERP. Al final muestra un resumen y los registros para revisar (por ejemplo, viajes sin tarifa vigente). El archivo `frabel-database` está en `.gitignore`: no se sube al repositorio.

## Cambios en la base de datos

1. Editar `src/db/schema.ts`.
2. `npm run db:generate -- --name descripcion-del-cambio` (genera el SQL en `drizzle/`).
3. `npm run db:migrate`.

`npm run db:studio` abre un explorador visual de la base.

## Deploy (Bitbucket → Vercel)

1. Subir el repo a Bitbucket.
2. En Vercel: *Add New Project* → importar el repo de Bitbucket.
3. Cargar las variables de entorno (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`).
4. Deploy. Agregar la URL final como redirect URI en Google (paso 3 de arriba).

Las migraciones no corren solas en el deploy: correr `npm run db:migrate` localmente (apunta a la misma base de Neon) cada vez que haya cambios en `drizzle/`.

## Estructura

```
src/
  app/(auth)/          login, pendiente, sin-acceso
  app/(app)/           módulos (contactos, ventas, finanzas, usuarios) + inicio
  app/api/             Auth.js y PDF de estado de cuenta
  db/schema.ts         tablas
  lib/permissions.ts   usuario actual y permisos (usado en cada página y acción)
  lib/rates.ts         tarifas vigentes y versiones del tarifario
  lib/balances.ts      saldos y estado de cuenta
scripts/               seed del admin e importación de la base anterior
drizzle/               migraciones SQL
```
