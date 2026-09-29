# Tareas

Cómo usar este archivo:

1. **Agregá tus tareas** en "Pendientes" copiando el bloque de ejemplo (o con `/nueva-tarea <descripción>`). Alcanza con título y descripción; el resto lo completa el especificador.
2. Corré `/tareas` (todas las listas) o `/tareas T-004 T-007` (algunas). Por defecto se frena para que apruebes cada spec antes de implementar; `/tareas auto` no se frena.
3. Las **recomendaciones** las agrega Claude en su sección (`/recomendar` pide más). Para hacer una, movela a "Pendientes" con estado `Nueva`, o corré `/tareas T-XXX` con su ID. Las recomendaciones **no** se ejecutan solas.

Estados: `Nueva` → `Especificada` (spec escrita, espera aprobación) → `Aprobada` → `En curso` → (`En revisión`, solo riesgo alto) → `Hecha` · también `Bloqueada` (con motivo).
Opciones de `/tareas`: `auto` (sin preguntar) · `nocommit` (por defecto hace un commit por tarea) · `revisar` (revisor también en riesgo bajo) · `recomendar`.
Prioridad: `Alta` · `Media` · `Baja`.

**Próximo ID: T-017**

---

## 📥 Pendientes
---

## 💡 Recomendadas por Claude (No implementar)

### T-002 · Cambiar contraseña del admin desde la app
- Estado: Recomendada
- Prioridad: Alta
- Spec: —
- Descripción: Pantalla "Mi cuenta" para que el usuario con login por usuario/contraseña cambie su clave (mínimo 8 caracteres). Hoy solo se puede por script y `2156` es débil para un sitio público. Hacer antes del deploy.

### T-004 · Cargas de combustible duplicadas (datos viejos)
- Estado: Recomendada
- Prioridad: Media
- Spec: —
- Descripción: En `Cargas_Extras` hay filas marcadas "Valor repetido, no dar bola" que hoy suman al consumo de Axion Sarmiento. Poder marcar una carga como "anulada" (excluida de los totales sin borrarla) y aplicarlo a esas filas.

### T-005 · Exportar listados a Excel
- Estado: Recomendada
- Prioridad: Media
- Spec: —
- Descripción: Botón "Exportar" en Ventas, Cobros, Gastos y Cuentas corrientes que descargue un .xlsx con los filtros aplicados.

### T-006 · Auditoría: quién cargó y modificó cada registro
- Estado: Recomendada
- Prioridad: Media
- Spec: —
- Descripción: Guardar `created_by` / `updated_by` en recorridos, cobros, gastos y tarifas, y mostrarlo en el detalle. Importante cuando varios usuarios editen.

### T-007 · Liquidación de choferes
- Estado: Recomendada
- Prioridad: Media
- Spec: —
- Descripción: Resumen por chofer y período con recorridos, pago por recorrido y adicionales; registrar el pago como gasto de categoría "Sueldos".

### T-008 · Envío del estado de cuenta por email
- Estado: Recomendada
- Prioridad: Baja
- Spec: —
- Descripción: Mandar el PDF al email del cliente desde la app (ej. con Resend), con registro de envíos.
---

## 🔧 Acciones manuales del equipo (fuera del código)

- [ ] Crear credenciales OAuth de Google y completar `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (pasos en README).
- [ ] Cambiar la contraseña de Neon (se compartió en el chat) y actualizar `.env.local`.
- [ ] Cargar el tarifario de Huentata y marcar "recalcular" (2 viajes con precio $0).
- [ ] Revisar el viaje City Tours de 8 plazas del 03/04/2026 (no existe esa tarifa).
- [ ] Responder: ¿Shell Maza es cuenta corriente o pago en el momento?
- [ ] Deploy en Vercel (README).

---

## ✅ Hechas

### T-016 · Gráficos e informes de Inicio
- Estado: Hecha (2026-09-28)
- Spec: specs/T-016-inicio-graficos-filtros.md
- Descripción: Gastos ahora incluye los costos de los recorridos (antes daba $0 en 2026) más los gastos generales. Se agregaron filtros desde/hasta y por cliente.

### T-015 · Tratamiento Clientes Potenciales
- Estado: Hecha (2026-09-28)
- Spec: specs/T-015-clientes-potenciales.md
- Descripción: Los potenciales tienen etapas (Sin contactar, Contactado, Ganado, Perdido). Al ganarse pasan a recurrente o especial, y al perderse quedan inactivos. Cada contacto tiene una pestaña de seguimiento con notas. Se importaron 29 prospectos (Impulsa Mendoza se omitió porque ya era cliente).

### T-001 · Choferes y vehículos como entidades
- Estado: Hecha (2026-09-28)
- Spec: specs/T-001-choferes-vehiculos.md
- Descripción: Pantalla Flota (`/flota`) con el ABM de choferes y vehículos y un resumen de costos y margen por vehículo y por chofer. Recorridos y gastos se asocian a un chofer y un vehículo. El vehículo no define la tarifa.

### T-014 · Resumen mensual con gráficos en Inicio
- Estado: Hecha (2026-09-28)
- Spec: specs/T-014-resumen-mensual.md
- Descripción: Inicio muestra los últimos 12 meses (facturado, cobrado, gastos y margen) en un gráfico y una tabla, y el top 10 de recorridos por cantidad.

### T-013 · Saldo inicial y ajustes en cuentas corrientes
- Estado: Hecha (2026-09-28)
- Spec: specs/T-013-saldo-historico.md
- Descripción: Movimientos tipo "ajuste" (no suman a Cobrado) + script idempotente que salda la deuda histórica mes a mes. Aplicado a **todos** los clientes (el usuario confirmó que pagaron todo): 29 ajustes, $198.588.500; ningún cliente queda con deuda.

### T-012 · Tests automáticos de la lógica crítica
- Estado: Hecha (2026-09-28)
- Spec: specs/T-012-tests-vitest.md
- Descripción: Vitest (`npm test`) con 27 tests de `parseAmount`, `formatMoney`, versionado de tarifas y estado de cuenta, sin tocar la base.

### T-011 · Solución de errores (estado de cuenta de Impulsa Mendoza)
- Estado: Hecha (2026-09-28)
- Spec: specs/T-011-error-estado-cuenta.md
- Descripción: Error "Jest worker encountered 2 child process exceptions" en rutas `[id]` (dev server sin terminal → EPIPE); cliente renombrado a "Impulsa Mendoza".

### T-000 · Primera versión del ERP (CRM)
- Estado: Hecha (2026-09-28)
- Descripción: Contactos, Ventas, Finanzas, Usuarios, login, importación de la base SQLite. Ver `specs/REGISTRO.md`.
