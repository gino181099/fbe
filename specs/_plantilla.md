# T-XXX · Título

- Estado: Borrador <!-- Borrador → Aprobada → Implementada -->
- Prioridad: Media
- Riesgo: Bajo <!-- Alto si toca esquema/migraciones, permisos, montos/saldos o scripts sobre datos de producción → lleva revisor -->
- Fecha: AAAA-MM-DD
- Tarea: `specs/TAREAS.md` → T-XXX

<!-- Largo orientativo: ≤ 120 líneas. Nada de pseudocódigo: alcanzan criterios + mapa. -->

## Contexto
Por qué se hace, en 2–4 líneas.

## Objetivo
Qué va a poder hacer el usuario cuando esté terminado.

## Criterios de aceptación
Verificables, uno por línea.
- [ ] CA1 …
- [ ] CA2 …

## Diseño
### Datos
Tablas/columnas nuevas o cambiadas, migración y backfill (o "Sin cambios").
### Permisos
Módulo y nivel requerido para ver / editar.
### UI
Pantallas, botones, textos en español.

## Mapa de código
Lo que el especificador ya exploró, para que el implementador **no tenga que explorar**. Una línea por punto:
- `ruta/archivo.ts` › `función` (~línea) — qué cambiar
- Reutilizar: `helper` de `ruta` (ej. `formToObject` en `src/lib/forms.ts`, `ConfirmButton`, `getBalances`)
- Patrón a imitar: `ruta/archivo-parecido.tsx`

## Plan
- [ ] 1. …
- [ ] 2. …

## Verificación
- `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build` (una vez, al final)
- Pruebas manuales: pasos concretos. Datos de prueba se crean y se **borran** (la base es producción).

## Fuera de alcance
- …

## Decisiones propuestas
No bloqueantes: el orquestador se las pregunta al usuario y anota la respuesta acá.
- D1 <pregunta> — **Por defecto:** … · Alternativa: …

## Preguntas bloqueantes
- … (si hay alguna, la tarea queda `Bloqueada` hasta que el usuario responda; si no, "Ninguna")

---

## Notas de implementación
_(completa el implementador: desvíos del plan, decisiones, archivos tocados)_

## Revisión
_(completa el revisor solo si Riesgo: Alto; si no, "No aplica (riesgo bajo, autochequeo del implementador)")_
