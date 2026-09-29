---
description: Corre el arnés spec-driven sobre las tareas de specs/TAREAS.md (especificar → aprobar → implementar → revisar → registrar)
argument-hint: "[T-001 T-002 …] [auto] [commit]"
---

Sos el **orquestador**. Argumentos: `$ARGUMENTS`
- IDs `T-XXX`: procesar solo esas tareas. Sin IDs: todas las de "📥 Pendientes" con estado `Nueva`, `Especificada` o `Aprobada`, por prioridad (Alta → Baja) y luego por ID.
- `auto`: no frenar para aprobar specs (se aprueban solas salvo preguntas bloqueantes).
- `commit`: al terminar cada tarea, hacer un commit con `T-XXX: <título>` (nunca push).

No hagas el trabajo de los subagentes vos mismo; tu contexto es para coordinar. No releas archivos que un subagente ya resumió.

## 0. Preparación
Leé `specs/TAREAS.md` (solo las tareas a procesar) y decí en una línea qué vas a correr. Si no hay tareas, sugerí `/nueva-tarea` o `/recomendar` y terminá. Las tareas `Bloqueada` no se ejecutan. Las `Recomendada` solo si se pidieron explícitamente por ID: en ese caso movelas a "📥 Pendientes" con `Estado: Nueva`.

## 1. Especificar (tareas en estado `Nueva`)
Lanzá el subagente `especificador` con: "Modo especificar T-XXX". Podés lanzar varios en paralelo si son tareas independientes.

## 2. Aprobar (tareas en estado `Especificada`)
- Sin `auto`: mostrá por tarea un resumen de 3–5 líneas (objetivo, criterios, cambios en la base, preguntas) y pedí aprobación con AskUserQuestion (Aprobar / Pedir cambios / Saltear). Con "Pedir cambios", pasale el pedido al `especificador` y volvé a preguntar.
- Con `auto`: aprobá salvo que haya preguntas bloqueantes (esas quedan `Bloqueada`).
- Al aprobar: `Estado: Aprobada` en la spec y en `TAREAS.md`.

## 3. Implementar (una tarea a la vez, en orden)
Poné `Estado: En curso` en `TAREAS.md` y lanzá `implementador` con la ruta de la spec.

## 4. Revisar
Lanzá `revisor` con la ruta de la spec. Pegá su respuesta en la sección "Revisión" de la spec.
Si el veredicto es `CAMBIOS REQUERIDOS`: lanzá `implementador` en modo "corregir hallazgos" con la lista y volvé a revisar. Máximo **2 rondas**; si sigue fallando, marcá la tarea `Bloqueada: <motivo>` y seguí con la próxima.

## 5. Cerrar la tarea
1. `specs/TAREAS.md`: mover la tarea a "✅ Hechas" con `Estado: Hecha (fecha)`.
2. `specs/REGISTRO.md`: agregar la entrada arriba de todo con el formato del archivo (≤ 12 líneas).
3. Si corresponde, `commit` (solo si se pidió): `git add` de los archivos de la tarea (nunca `.env*` ni `frabel-database*`) y commit.

## 6. Cierre de la corrida
- Lanzá `especificador` en modo "recomendar" (máx. 2 tareas) solo si en la corrida aparecieron pendientes nuevos.
- Resumen final al usuario (≤ 10 líneas): tareas hechas, bloqueadas (y qué falta para destrabarlas), cómo probar lo nuevo, recomendaciones agregadas.
