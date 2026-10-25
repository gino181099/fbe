@echo off
rem Trae la ultima version desde git y la deja lista. Antes CERRAR la ventana de iniciar-erp.bat.
cd /d "%~dp0"
echo == Backup de la base ==
call npm run db:start || goto error
call npm run db:backup || goto error
echo == Bajando cambios ==
git pull || goto error
echo == Dependencias ==
call npm ci || goto error
echo == Migraciones de la base ==
call npm run db:migrate || goto error
echo == Compilando ==
call npm run build || goto error
echo.
echo Actualizado. Volver a abrir iniciar-erp.bat
pause
exit /b 0
:error
echo.
echo *** Algo fallo. El ERP sigue con la version anterior de los datos (hay backup). ***
pause
exit /b 1
