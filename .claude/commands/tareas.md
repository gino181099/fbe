---
description: Corre el arnés spec-driven sobre las tareas de specs/TAREAS.md (especificar → aprobar → implementar → revisar si hay riesgo → registrar)
argument-hint: "[T-XXX ...] [auto] [nocommit] [revisar] [recomendar]"
---

Sos el **orquestador**. Argumentos: `$ARGUMENTS`
- IDs `T-XXX`: procesar solo esas tareas. Sin IDs: todas las de "📥 Pendientes" con estado `Nueva`, `Especificada` o `Aprobada`, por prioridad (Alta → Baja) y luego por ID.
- `auto`: no preguntar; se aprueban las specs con las opciones por defecto (salvo preguntas bloqueantes).
- `nocommit`: no hacer commits (por defecto se hace uno por tarea; nunca push).
- `revisar`: lanzar el revisor en todas las tareas, aunque sean de riesgo bajo.
- `recomendar`: al final, pedir hasta 2 recomendaciones al especificador.

No hagas el trabajo de los subagentes; tu contexto es para coordinar. No releas archivos que un subagente ya resumió. Los subagentes escriben el registro: vos solo lo completás.

## 0. Preparación
- Leé en `specs/TAREAS.md` solo el encabezado y las tareas a procesar. Si hay IDs repetidos, renumerá con el "Próximo ID". Decí en una línea qué vas a correr.
- Si no hay tareas, sugerí `/nueva-tarea` o `/recomendar` y terminá. Las `Bloqueada` no se ejecutan. Las `Recomendada` solo si se pidieron por ID (movelas a Pendientes con `Estado: Nueva`).
- Si `git status --short` muestra cambios ajenos y no se pasó `nocommit`, avisá y preguntá si se commitean como base antes de empezar (el revisor necesita un `git diff` limpio).

## 1. Especificar (estado `Nueva`)
Lanzá un `especificador` por tarea **en paralelo** ("Modo especificar T-XXX"; avisale qué otras se especifican a la vez si comparten archivos o migraciones).

## 2. Aprobar (estado `Especificada`) — lo menos posible de idas y vueltas
- Sin `auto`: juntá en **un solo** AskUserQuestion (máx. 4 preguntas; si hay más, en tandas) la aprobación de cada spec (Aprobar / Pedir cambios / Saltear, con resumen de 2–3 líneas: objetivo, riesgo, cambios en la base) y sus "Decisiones propuestas" (opción por defecto primero, "(Recomendado)").
- Anotá las respuestas **vos mismo** con un Edit en "Decisiones propuestas" de la spec (`✅ Usuario: …`) y poné `Estado: Aprobada` en spec y TAREAS. Retomá al `especificador` (SendMessage) solo si el usuario pidió un cambio de diseño que no se resuelve anotando la respuesta.
- No esperes a tener todas aprobadas: apenas una queda aprobada, implementala (paso 3) mientras seguís con las demás.

## 3. Implementar (de a una, en orden: migraciones y archivos compartidos)
`Estado: En curso` en TAREAS y lanzá `implementador` con la ruta de la spec (mencioná tareas hechas en esta corrida que no debe romper). Anotá tokens y duración que trae la notificación de cada agente.

## 4. Revisar (solo `Riesgo: Alto` o argumento `revisar`)
- Riesgo Bajo: no hay revisor; el implementador ya hizo su autochequeo y cerró el registro.
- Riesgo Alto: lanzá `revisor` con la ruta de la spec y "tsc/lint/build OK según el implementador". El revisor escribe su veredicto en la spec.
- `CAMBIOS REQUERIDOS`: `implementador` en modo "corregir hallazgos" con la lista y volvé a revisar. Máximo **2 rondas**; si sigue fallando, `Bloqueada: <motivo>` y seguí con la próxima.
- Hallazgos MENORES con APROBADO: no se corrigen en la corrida; quedan en la spec y el REGISTRO los lista como pendientes.

## 5. Cerrar la tarea
1. Riesgo Alto aprobada: mové el bloque en TAREAS a "✅ Hechas" (`Estado: Hecha (fecha)`, 1–2 líneas) y completá `Revisión:` en su entrada de REGISTRO.
2. En la entrada de REGISTRO agregá `- Costo: spec Xk · impl Yk · rev Zk tokens · N min` (de las notificaciones).
3. Salvo `nocommit`: `git add` de los archivos de la tarea (nunca `.env*` ni `frabel-database*`) y `git commit -m "T-XXX: <título>"`.

## 6. Cierre de la corrida
- Solo con `recomendar`: `especificador` en modo "recomendar" (máx. 2).
- Resumen al usuario (≤ 10 líneas): tareas hechas, bloqueadas (y qué falta), cómo probar lo nuevo, costo total aproximado.
