# Frabel ERP

ERP de Frabel (transporte de pasajeros). Corre **100% local**: una PC de la oficina hace de servidor (base de datos + aplicación) y las demás PCs de la red entran por el navegador.

| Módulo | Qué hace |
| --- | --- |
| **Contactos** | Clientes actuales y potenciales. *Recurrentes* (con tarifario por recorrido y capacidad) o *especiales* (servicios puntuales). Tarifario con historial de versiones y carga desde Excel/CSV. |
| **Leads** | Oportunidades comerciales (CRM). |
| **Ventas** | Recorridos realizados. Para clientes recurrentes el precio sale solo de la tarifa vigente en la fecha del viaje. |
| **Finanzas** | Cuentas corrientes, cobros, recibos, comprobantes, gastos, combustible, proveedores y PDFs. |

Stack: Next.js 16 · PostgreSQL 18 local (binarios por npm, `@embedded-postgres/windows-x64`) + Drizzle ORM · Auth.js v5 (clave única) · Tailwind + shadcn/ui · react-pdf.

## Acceso

Se entra con la clave única **`belinda2156`** (definida en `src/lib/config.ts`, junto con el resto de la configuración). No hay `.env` obligatorio.

## Instalación en la PC servidor (una sola vez)

Requisitos: Windows x64, [Node 22+](https://nodejs.org) y [Git](https://git-scm.com).

```bat
git clone <url del repo de Bitbucket> C:\FrabelERP
cd C:\FrabelERP
instalar.bat
```

`instalar.bat` instala dependencias (incluido Postgres), crea la base y la compila. Los datos quedan en `%USERPROFILE%\frabel-erp-datos\` (fuera del proyecto: **nunca dentro de OneDrive**).

Para traer los datos desde otra PC: copiar un backup (`.json.gz`) y correr

```bat
npm run db:restore -- "C:\ruta\frabel-AAAA-MM-DD-HHMM.json.gz"
```

### Uso diario

- `iniciar-erp.bat`: arranca la base y el ERP. Dejar la ventana abierta.
- En esa PC: http://localhost:3000 · Desde otras PCs: `http://<IP de la PC servidor>:3000` (ver la IP con `ipconfig`; conviene fijarla en el router).
- Para que arranque solo al prender la PC: `Win + R` → `shell:startup` → crear ahí un acceso directo a `iniciar-erp.bat`.
- Firewall (una vez, en una consola **como administrador**):
  ```bat
  netsh advfirewall firewall add rule name="Frabel ERP" dir=in action=allow protocol=TCP localport=3000
  ```

### Actualizar a una versión nueva

1. Cerrar la ventana de `iniciar-erp.bat`.
2. Doble clic en `actualizar.bat` (backup → `git pull` → dependencias → migraciones → compilación).
3. Abrir de nuevo `iniciar-erp.bat`.

### Backups

- Se hace uno automático cada vez que arranca el ERP y antes de cada actualización/restauración, en `%USERPROFILE%\frabel-erp-datos\backups\` (se guardan los últimos 60).
- Manual: `npm run db:backup`. Conviene copiar esa carpeta a un pendrive o disco externo de vez en cuando.
- Restaurar: `npm run db:restore -- "<archivo>"` (reemplaza toda la base; antes guarda un backup de lo que había).

## Desarrollo (esta PC)

```bash
npm install
npm run db:setup     # primera vez: crea la base local y aplica migraciones
npm run dev          # levanta Postgres si hace falta + next dev en http://localhost:3000
```

`npm run dev` es solo para programar; la PC de la oficina usa la versión compilada (`npm run build` + `npm start`), que es mucho más rápida.

Otros comandos: `npm run db:start | db:stop | db:status` (Postgres en el puerto 5433, solo accesible desde la misma PC), `npm run db:studio` (explorador visual).

### Cambios en la base de datos

1. Editar `src/db/schema.ts`.
2. `npm run db:generate -- --name descripcion-del-cambio` (genera el SQL en `drizzle/`).
3. `npm run db:migrate`. En la PC servidor las aplica `actualizar.bat`.

### Publicar cambios

`git push` al repo de Bitbucket; en la PC servidor, `actualizar.bat`.

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
  lib/config.ts        clave, puerto y carpetas de la base
  lib/permissions.ts   usuario actual y permisos
scripts/               db.ts (Postgres local), local.ts (arranque), datos.ts (backup/restore/copia de Neon), importaciones
drizzle/               migraciones SQL
*.bat                  instalar / iniciar / actualizar en la PC servidor
```
