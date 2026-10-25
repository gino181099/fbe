@echo off
rem Instalacion inicial del ERP en esta PC (una sola vez). Requiere Node 22+ y Git.
cd /d "%~dp0"
echo == Instalando dependencias (incluye Postgres) ==
call npm ci || goto error
echo == Creando la base de datos local y sus tablas ==
call npm run db:setup || goto error
echo == Compilando el ERP ==
call npm run build || goto error
echo.
echo Listo. Para usarlo: doble clic en iniciar-erp.bat
echo Para traer los datos de otra PC: npm run db:restore -- "ruta\al\backup.json.gz"
pause
exit /b 0
:error
echo.
echo *** Algo fallo. Revisar los mensajes de arriba. ***
pause
exit /b 1
