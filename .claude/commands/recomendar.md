---
description: Pide al especificador nuevas tareas recomendadas para specs/TAREAS.md
argument-hint: "[cantidad] [foco, ej: seguridad | finanzas | UX]"
---

Lanzá el subagente `especificador` en modo "recomendar" con estos parámetros: `$ARGUMENTS` (cantidad por defecto 3; si hay un foco, limitarse a ese tema).

Cuando termine, mostrá al usuario la lista de recomendaciones agregadas (ID · título · prioridad, una por línea) y recordale que para ejecutarlas tiene que moverlas a "📥 Pendientes" o pedir `/tareas T-XXX`.
