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

## Producción (PC de la oficina)

> Guía paso a paso, con el tutorial para fijar la IP: **[GUIA-INSTALACION.md](GUIA-INSTALACION.md)**. Abajo, el resumen.

- **Código y datos separados:** el código vive en `C:\FrabelERP` (repo, se actualiza con git) y los datos en `C:\FrabelERP-datos` (Postgres y backups; git nunca los toca).
- **Instalar (un comando):** en tu PC, `npm run db:exportar-inicial` + commit + push. En la oficina:
  `git clone <repo> C:\FrabelERP && C:\FrabelERP\instalar.bat`. Eso instala, crea la base, carga `datos-iniciales/` **solo si la base está vacía**, compila, abre el firewall, configura el arranque automático y desactiva la suspensión.
- **Usar:** arranca solo con Windows (`iniciar-erp.bat`). `http://localhost:3000`, o `http://<IP>:3000` desde la red.
- **Actualizar:** cerrar el ERP y correr `actualizar.bat` (backup → `git pull` → `npm ci` → migraciones → build). No toca los datos.
- **Backups:** automáticos en cada arranque y antes de cada actualización, en `C:\FrabelERP-datos\backups\` (los últimos 60). Manual: `npm run db:backup`. Restaurar: `npm run db:restore -- "<archivo>"` (reemplaza todo; antes guarda backup).

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
