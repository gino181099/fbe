# Checklist de calidad

La usan el implementador (autochequeo antes de terminar) y el revisor. Chequear solo lo que toca el cambio.

- **Permisos**: toda server action nueva empieza con `checkPermission("<módulo>")`; toda página nueva usa `requirePermission`. Controles de edición ocultos sin `edit`; ningún dato de otro módulo visible sin su permiso (ej. montos → `finanzas`).
- **Validación**: zod vía `formToObject`; mensajes en español (también `.min`/`.max`); devolver `ActionResult`; `revalidatePath` de las rutas afectadas.
- **Montos y fechas**: `parseAmount`/`zMoney`; fechas string `YYYY-MM-DD` (nunca `Date` para días, `today()` en zona AR); `formatMoney`/`formatDate` en la UI.
- **Cliente/servidor**: componentes cliente sin imports de valores de `@/db/schema` (solo `import type`); constantes compartidas en `src/lib/constants.ts`.
- **Datos**: varias escrituras juntas en `db.batch`; migraciones aditivas con backfill en el SQL; seeds/backfills/scripts idempotentes; nada destructivo sobre datos reales (la base es producción). Errores de FK: códigos `23001` y `23503`.
- **Higiene**: textos de UI en español; sin `console.log` olvidados; sin secretos ni `.env*`/`frabel-database*`; sin cambios fuera del alcance de la spec.
- **Lógica**: casos borde (vacío, null, negativos, división por cero, límites de vigencia y de mes); lógica pura nueva con test en Vitest.
