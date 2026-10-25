@echo off
rem Instalacion completa del ERP en la PC de produccion. Requiere Node 22+ y Git.
rem Se puede volver a correr sin riesgo: si la base ya tiene datos, NO se tocan.
title Instalando Frabel ERP
cd /d "%~dp0"

echo == 1/6 Instalando dependencias (incluye la base de datos) ==
call npm ci || goto error

echo == 2/6 Creando la base de datos y sus tablas ==
call npm run db:setup || goto error

echo == 3/6 Cargando los datos iniciales del repositorio ==
call npm run db:inicializar || goto error

echo == 4/6 Compilando el ERP ==
call npm run build || goto error

echo == 5/6 Configurando Windows ==
rem Firewall: abre el puerto 3000 para las otras PCs (Windows pide permiso de administrador).
netsh advfirewall firewall show rule name="Frabel ERP" >nul 2>&1
if errorlevel 1 (
  echo Windows va a pedir permiso para abrir el puerto 3000 en el firewall: aceptar.
  powershell -NoProfile -Command "Start-Process netsh -Verb RunAs -Wait -ArgumentList 'advfirewall firewall add rule name=\"Frabel ERP\" dir=in action=allow protocol=TCP localport=3000'"
)
rem Arranque automatico al iniciar sesion (acceso directo minimizado en la carpeta Inicio).
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Frabel ERP.lnk'); $s.TargetPath='%~dp0iniciar-erp.bat'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()"
echo - Arranque automatico al prender la PC: listo.
rem Que la PC no se suspenda enchufada (si se suspende, nadie puede entrar al ERP).
powercfg /change standby-timeout-ac 0 >nul 2>&1
echo - Suspension desactivada (con la PC enchufada).

echo == 6/6 Datos de red ==
echo Desde las otras PCs se entra con http://IP:3000 usando esta IP:
ipconfig | findstr /c:"IPv4"
echo (Para que no cambie, fijarla: ver GUIA-INSTALACION.md, seccion "Fijar la IP")
echo.
echo ==================================================
echo  Instalacion terminada. Clave de ingreso: belinda2156
echo ==================================================
choice /c SN /m "Iniciar el ERP ahora"
if errorlevel 2 exit /b 0
start "" "%~dp0iniciar-erp.bat"
exit /b 0

:error
echo.
echo *** Algo fallo. Revisar los mensajes de arriba (y GUIA-INSTALACION.md, "Problemas comunes"). ***
pause
exit /b 1
