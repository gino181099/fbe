@echo off
rem Arranca la base local y el ERP (modo produccion). Dejar esta ventana abierta mientras se usa.
title Frabel ERP
cd /d "%~dp0"
call npm start
pause
