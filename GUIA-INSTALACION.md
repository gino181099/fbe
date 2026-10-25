# Guía: instalar el ERP en la PC de la oficina (producción)

Hay dos PCs con roles distintos:

| | PC de desarrollo (la tuya) | PC de producción (oficina) |
| --- | --- | --- |
| Para qué | Programar y probar cambios | Uso diario: acá se cargan los datos reales |
| Código | Se sube a Bitbucket (`git push`) | Se baja de Bitbucket (`actualizar.bat`) |
| Datos | De prueba | **Los reales y los únicos que valen** |

**El código y los datos están separados:**

- `C:\FrabelERP` → el código. Es lo que viaja por Bitbucket.
- `C:\FrabelERP-datos` → la base de datos y los backups. **Nunca** viaja por Bitbucket, y las actualizaciones no la tocan.

Los datos pasan de tu PC a la oficina **una sola vez**, en la instalación, con el archivo de *datos iniciales*. Después, cada PC tiene su propia base.

Tiempo estimado: 20–30 minutos.

---

## Parte 1 · En TU PC (cuando termines de cargar los datos)

### 1. Exportar los datos iniciales y subir todo

En la carpeta del proyecto:

```bat
npm run db:exportar-inicial
git add datos-iniciales
git commit -m "Datos iniciales para producción"
git push
```

`db:exportar-inicial` guarda tu base en `datos-iniciales/frabel-inicial.json.gz`, dentro del repo, para que viaje a la otra PC.

> ⚠️ Lo que cargues en tu PC **después** de este paso no llega a la oficina. Exportá justo antes de instalar.

Repositorio (privado): `https://bitbucket.org/gfs181099/frabel-erp` · rama `main`.

---

## Parte 2 · En la PC de la OFICINA

Requisitos: **Windows 10/11 de 64 bits** con internet. Internet solo hace falta para instalar y actualizar; el ERP funciona sin él.

### 2. Instalar Node.js y Git (una sola vez)

1. **Node.js:** descargar la versión **LTS** de https://nodejs.org e instalar con las opciones por defecto.
2. **Git:** descargar de https://git-scm.com/download/win e instalar con las opciones por defecto.

### 3. Instalar el ERP (un solo comando)

Abrir una consola (tecla Windows → escribir `cmd` → Enter) y pegar:

```bat
git clone https://gfs181099@bitbucket.org/gfs181099/frabel-erp.git C:\FrabelERP && C:\FrabelERP\instalar.bat
```

- Bitbucket pide usuario y contraseña. Como contraseña va un **token de acceso**, no la clave de la cuenta. Se crea en Bitbucket → ⚙️ *Personal settings* → *API tokens* (o *App passwords*), con permiso de **lectura de repositorios**.
- Windows va a pedir permiso de administrador para abrir el puerto en el firewall: aceptar.

`instalar.bat` hace todo solo:

1. instala las dependencias, incluida la base de datos;
2. crea la base en `C:\FrabelERP-datos`;
3. **carga los datos iniciales**, solo si la base está vacía (si ya tiene datos, no los toca);
4. compila el ERP;
5. abre el puerto 3000 en el firewall, configura que el ERP arranque solo al prender la PC y desactiva la suspensión;
6. muestra la IP de la PC y pregunta si querés iniciar el ERP.

Al final: abrir **http://localhost:3000** y entrar con la clave **`belinda2156`**.

### 4. Fijar la IP de la PC

Las otras PCs entran por `http://<IP>:3000`. Si la IP cambia (los routers la cambian solos a veces), dejan de encontrar el ERP. Hay dos formas de fijarla; la **A** es la mejor.

#### A) Reservar la IP en el router (recomendado)

Así la IP queda fija aunque se reinstale Windows.

1. En la PC de la oficina, abrir `cmd` y correr `ipconfig /all`. Anotar, del adaptador que tenga *Dirección IPv4* (Ethernet o Wi-Fi):
   - **Dirección física** (la MAC), por ejemplo `A4-BB-6D-12-34-56`;
   - **Dirección IPv4**, por ejemplo `192.168.0.25`;
   - **Puerta de enlace predeterminada**, por ejemplo `192.168.0.1`. Esa es la dirección del router.
2. Abrir en el navegador `http://192.168.0.1`, con la puerta de enlace que anotaste. Entrar con el usuario y la clave del router (suelen estar en una etiqueta debajo del router).
3. Buscar la sección **DHCP**, **LAN** o **Red local**, y dentro **Reserva de direcciones**, **DHCP estático**, **Address Reservation** o **IP fija**. Cada marca la llama distinto.
4. Agregar una reserva con la **MAC** y la **IP** que anotaste. Guardar.
5. Reiniciar la PC y comprobar con `ipconfig` que mantiene la misma IP.

#### B) IP manual en Windows (si no tenés acceso al router)

1. Correr `ipconfig /all` y anotar la **Dirección IPv4**, la **Máscara de subred** (casi siempre `255.255.255.0`), la **Puerta de enlace** y los **Servidores DNS**.
2. Elegir una IP de la misma red que **nadie más use**. Conviene una alta: si la PC tiene `192.168.0.25`, usar por ejemplo `192.168.0.200`. Para verificar que esté libre, correr `ping 192.168.0.200`: tiene que contestar *"Tiempo de espera agotado"* o *"Host de destino inaccesible"*.
3. *Configuración* → *Red e Internet* → **Ethernet** (o **Wi-Fi** → *Propiedades de la red*).
4. En **Asignación de IP** → *Editar* → elegir **Manual** → activar **IPv4** y completar:
   - Dirección IP: `192.168.0.200`
   - Máscara de subred: `255.255.255.0`
   - Puerta de enlace: la anotada (ej. `192.168.0.1`)
   - DNS preferido: el anotado, o `8.8.8.8`
5. Guardar y comprobar que hay internet y que `ipconfig` muestra la IP nueva.

> Si en algún momento cambiás de router, la opción B puede dejar la PC sin red: volvé a poner **Automático (DHCP)**.

### 5. Entrar desde las otras PCs

En cualquier PC de la misma red, abrir el navegador en `http://192.168.0.200:3000` (con la IP fija). Conviene guardarlo en favoritos o crear un acceso directo en el escritorio.

✅ **Listo, el ERP queda en producción.**

### 6. Sacar los datos iniciales del repo

Una vez que la oficina está funcionando, pedile a Claude que quite `datos-iniciales/` del repositorio. Así los datos no vuelven a viajar con el código.

---

## Uso diario

| Qué | Cómo |
| --- | --- |
| Entrar | `http://localhost:3000` en la PC de la oficina, o `http://<IP>:3000` desde otra PC. Clave `belinda2156` |
| Arranque | Automático al prender la PC (queda una ventana minimizada "Frabel ERP": no cerrarla) |
| Si no responde | Cerrar la ventana "Frabel ERP" y abrir `C:\FrabelERP\iniciar-erp.bat` |

## Actualizar el ERP (cambios de código)

Cuando subas cambios desde tu PC (`git push`):

1. En la PC de la oficina, cerrar la ventana "Frabel ERP".
2. Doble clic en `C:\FrabelERP\actualizar.bat`. Hace un backup, baja el código nuevo, ajusta las tablas si hace falta y recompila. **Los datos no se tocan.**
3. Abrir `iniciar-erp.bat`, o reiniciar la PC.

Hacerlo fuera del horario de trabajo: mientras actualiza, nadie puede usar el ERP.

## Backups

- **Automáticos:** se hace uno cada vez que arranca el ERP y otro antes de cada actualización. Quedan en `C:\FrabelERP-datos\backups\` (se guardan los últimos 60).
- ⚠️ Están en el mismo disco que la base. **Una vez por semana**, copiar esa carpeta a un pendrive, disco externo o Drive.
- **Manual:** en `C:\FrabelERP`, correr `npm run db:backup`.
- **Restaurar** (reemplaza **todos** los datos; antes guarda una copia de lo que había):
  ```bat
  cd C:\FrabelERP
  npm run db:start
  npm run db:restore -- "C:\FrabelERP-datos\backups\frabel-AAAA-MM-DD-HHMM.json.gz"
  ```
- **Traer los datos reales a tu PC para probar algo:** copiar un backup de la oficina y restaurarlo en tu PC con el mismo comando.

## Mudar producción a otra PC

1. En la PC vieja: `npm run db:backup` y copiar el archivo.
2. En la PC nueva: pasos 2 y 3 de esta guía.
3. Restaurar el backup (ver *Backups*).

---

## Problemas comunes

| Síntoma | Solución |
| --- | --- |
| `node` o `git` "no se reconoce como comando" | Falta instalarlos (paso 2), o hay que cerrar la consola y abrir una nueva. |
| `instalar.bat` falla en "Instalando dependencias" | Revisar internet y volver a correrlo: es seguro repetirlo. |
| "La base ya tiene datos: no se cargan los datos iniciales" | Es lo esperado si ya estaba instalado: protege los datos de producción. |
| "El volcado es de una versión más nueva del ERP" | El backup viene de una versión más nueva: correr `actualizar.bat` y repetir. |
| `EADDRINUSE` / puerto 3000 en uso | Ya hay un ERP abierto. Cerrar las ventanas "Frabel ERP", o reiniciar la PC. |
| Desde otra PC no carga | Revisar que la PC de la oficina esté prendida, que la IP sea la correcta (`ipconfig`) y que las dos PCs estén en la misma red. |
| `actualizar.bat` falla con "EPERM" | El ERP seguía abierto: cerrar la ventana "Frabel ERP" y repetir. |
| `git` pide usuario y contraseña | Usar el token de Bitbucket (paso 3). |
| Estado de la base | `npm run db:status` · log en `C:\FrabelERP-datos\postgres.log` |
