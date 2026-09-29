---
description: Agrega una tarea a la sección Pendientes de specs/TAREAS.md
argument-hint: "<descripción de la tarea> [prioridad alta|media|baja]"
---

Agregá una tarea a `specs/TAREAS.md` a partir de: `$ARGUMENTS`

1. Leé el encabezado de `specs/TAREAS.md` para obtener el "Próximo ID" y los títulos existentes (no dupliques: si ya existe algo equivalente, avisá y no agregues).
2. Insertá al final de "📥 Pendientes" (reemplazando "_(sin tareas cargadas)_" si está) un bloque:
   ```
   ### T-XXX · <título corto e imperativo>
   - Estado: Nueva
   - Prioridad: <la indicada, o Media>
   - Spec: —
   - Descripción: <la descripción del usuario, prolija, sin inventar requisitos>
   ```
3. Incrementá el "Próximo ID".
4. Respondé en una línea con el ID asignado y recordá que `/tareas T-XXX` la ejecuta.

No leas código ni lances subagentes.
