# Guía: instalar el ERP en la PC de la oficina

Esta guía explica cómo dejar el ERP funcionando en la PC que va a hacer de **servidor**. Esa PC guarda la base de datos y el sistema, y las demás PCs de la red entran desde el navegador.

Tiempo estimado: 30–45 minutos la primera vez.

---

## Antes de empezar (en TU PC, la de desarrollo)

### 1. Subir la última versión a Bitbucket

Si todavía no existe el repositorio:

1. En Bitbucket, crear un repositorio **privado** vacío (sin README) llamado, por ejemplo, `frabel-erp`.
2. En la carpeta del proyecto:
   ```bat
   git remote add origin https://bitbucket.org/<tu-usuario>/frabel-erp.git
   git push -u origin master
   ```

Si ya existe, alcanza con `git push`.

### 2. Sacar un backup de los datos

```bat
npm run db:backup
```

El comando muestra dónde guardó el archivo, por ejemplo:
`C:\Users\ginof\frabel-erp-datos\backups\frabel-2026-10-25-1105.json.gz`

Copiá **ese archivo** a un pendrive o mandalo por Drive/mail. Es toda la información del ERP.

> ⚠️ A partir de este momento, lo que se cargue en tu PC **no** va a pasar a la oficina. Hacé el backup justo antes de instalar y después trabajá solo en la PC de la oficina.

---

## En la PC de la oficina

Requisitos: **Windows 10/11 de 64 bits** con conexión a internet (solo para instalar y actualizar).

### 3. Instalar Node.js

1. Entrar a https://nodejs.org y descargar la versión **LTS** (22 o superior).
2. Instalar con las opciones por defecto (Siguiente → Siguiente → Instalar).

### 4. Instalar Git

1. Entrar a https://git-scm.com/download/win y descargar el instalador.
2. Instalar con las opciones por defecto.

Para comprobar que las dos cosas quedaron instaladas, abrí una consola nueva (tecla Windows → escribir `cmd` → Enter) y corré:

```bat
node -v
git --version
```

Los dos tienen que mostrar un número de versión.

### 5. Descargar el ERP

En la misma consola:

```bat
cd C:\
git clone https://bitbucket.org/<tu-usuario>/frabel-erp.git FrabelERP
```

Bitbucket te va a pedir usuario y contraseña. Como contraseña se usa un **token de acceso**, no la clave de la cuenta: se crea en Bitbucket → *Personal settings* → *API tokens* (o *App passwords*), con permiso de **lectura de repositorios**.

> 📁 Instalá siempre en `C:\FrabelERP` o en otra carpeta común. **Nunca** dentro de OneDrive, Escritorio sincronizado ni Dropbox.

### 6. Instalar

Abrir la carpeta `C:\FrabelERP` en el explorador y hacer **doble clic en `instalar.bat`**.

Esto tarda varios minutos:
- descarga las dependencias, incluida la base de datos PostgreSQL;
- crea la base de datos en `C:\Users\<usuario>\frabel-erp-datos\`;
- compila el sistema.

Al final dice **"Listo"**. Si dice "Algo falló", ver [Problemas comunes](#problemas-comunes).

### 7. Cargar los datos

1. Copiar el backup del paso 2 a la PC, por ejemplo a `C:\FrabelERP\backup.json.gz`.
2. En una consola:
   ```bat
   cd C:\FrabelERP
   npm run db:start
   npm run db:restore -- "C:\FrabelERP\backup.json.gz"
   ```
3. Tiene que mostrar una lista de tablas, todas con `OK`.
4. Ya podés borrar `backup.json.gz` de esa carpeta.

### 8. Arrancar el ERP

Doble clic en **`iniciar-erp.bat`**. Se abre una ventana negra con el mensaje `Ready`.

- **No cerrar esa ventana** mientras se use el ERP. Se puede minimizar.
- Abrir el navegador en **http://localhost:3000** e ingresar con la clave **`belinda2156`**.

### 9. Habilitar el acceso desde las otras PCs

**a) Abrir el puerto en el firewall** (una sola vez):
tecla Windows → escribir `cmd` → clic derecho → **Ejecutar como administrador**, y correr:

```bat
netsh advfirewall firewall add rule name="Frabel ERP" dir=in action=allow protocol=TCP localport=3000
```

**b) Averiguar la IP de la PC servidor:** en una consola, `ipconfig`. Buscar **Dirección IPv4**, por ejemplo `192.168.0.25`.

**c) Desde cualquier otra PC de la red:** abrir el navegador en `http://192.168.0.25:3000` (con la IP de tu servidor). Conviene guardarlo en favoritos o crear un acceso directo en el escritorio.

**d) IP fija (recomendado):** si la IP cambia, las otras PCs dejan de encontrar el ERP. Pedile a quien maneje el router que le reserve siempre la misma IP a esta PC (en el router suele llamarse "Reserva DHCP" o "IP estática").

### 10. Que arranque solo al prender la PC

1. Tecla Windows + `R` → escribir `shell:startup` → Enter.
2. En la carpeta que se abre: clic derecho → *Nuevo* → *Acceso directo* → elegir `C:\FrabelERP\iniciar-erp.bat`.

Además, en *Configuración → Sistema → Inicio/apagado y suspensión*, poner **Suspender: Nunca**. Si la PC se suspende, nadie puede entrar al ERP.

✅ **Listo, el ERP queda instalado.**

---

## Uso diario

| Qué | Cómo |
| --- | --- |
| Entrar | `http://localhost:3000` en el servidor, o `http://<IP>:3000` desde otra PC. Clave: `belinda2156` |
| Si el ERP no responde | Cerrar la ventana negra y volver a abrir `iniciar-erp.bat` |
| Apagar la PC | Normal; al prender arranca solo (paso 10) |

## Actualizar a una versión nueva

Cuando subas cambios a Bitbucket desde tu PC (`git push`):

1. En la PC de la oficina, **cerrar la ventana de `iniciar-erp.bat`**.
2. Doble clic en **`actualizar.bat`**. Hace un backup, baja los cambios, actualiza la base y recompila.
3. Cuando dice "Actualizado", volver a abrir `iniciar-erp.bat`.

Hacerlo fuera del horario de trabajo: mientras actualiza, nadie puede usar el ERP.

## Backups

- Se hace uno **automático cada vez que arranca el ERP** y antes de cada actualización. Se guardan en `C:\Users\<usuario>\frabel-erp-datos\backups\` (los últimos 60).
- **Importante:** esos backups están en el mismo disco. Copiá esa carpeta **una vez por semana** a un pendrive, disco externo o Drive. Si el disco se rompe, es lo único que salva los datos.
- Backup manual: en `C:\FrabelERP`, correr `npm run db:backup`.
- Restaurar un backup (reemplaza **todos** los datos actuales, aunque antes guarda una copia de lo que había):
  ```bat
  cd C:\FrabelERP
  npm run db:start
  npm run db:restore -- "C:\ruta\al\frabel-AAAA-MM-DD-HHMM.json.gz"
  ```

## Cambiar de PC servidor en el futuro

Repetir esta guía en la PC nueva. En el paso 2, el backup se saca de la PC servidor vieja.

---

## Problemas comunes

| Síntoma | Solución |
| --- | --- |
| `node` o `git` "no se reconoce como comando" | Falta instalar (pasos 3–4) o hay que cerrar y abrir la consola de nuevo. |
| `instalar.bat` falla en "Instalando dependencias" | Revisar la conexión a internet y volver a correrlo. |
| "Las migraciones del origen y de la base local no coinciden" al restaurar | El backup es de otra versión del ERP. Actualizar las dos PCs a la misma versión (`git pull` + `actualizar.bat`) y sacar un backup nuevo. |
| `EADDRINUSE` / puerto 3000 en uso | Ya hay un ERP abierto. Cerrar todas las ventanas negras, o reiniciar la PC. |
| Desde otra PC no carga | Revisar que el servidor esté prendido con la ventana abierta, que la IP sea la correcta (`ipconfig`) y que se haya hecho el paso 9a. |
| `actualizar.bat` falla en `npm ci` con "EPERM" | El ERP seguía abierto: cerrar la ventana de `iniciar-erp.bat` y repetir. |
| `git pull` pide usuario/contraseña | Usar el token de Bitbucket (paso 5). |
| Ver el estado de la base | `npm run db:status` · log en `C:\Users\<usuario>\frabel-erp-datos\postgres.log` |
