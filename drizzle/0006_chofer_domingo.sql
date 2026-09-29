-- "Mingo" es Domingo Sículo (uno de los dueños, que a veces hace recorridos).
-- Alta idempotente del chofer (mismo patrón que el seed de 0003).
INSERT INTO "driver" ("name")
SELECT v.name FROM (VALUES ('Domingo Sículo')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM "driver" d WHERE lower(d."name") = lower(v.name));--> statement-breakpoint
-- Backfill de trip.driver_id para "Mingo" / "Domingo" / "Domingo Sículo" (sin mayúsculas/acentos/espacios extra).
-- trip.driver (texto histórico) no se toca.
UPDATE "trip" t SET "driver_id" = d."id"
FROM (SELECT min("id") AS "id" FROM "driver" WHERE lower("name") = lower('Domingo Sículo')) d
WHERE t."driver_id" IS NULL
	AND t."driver" IS NOT NULL
	AND d."id" IS NOT NULL
	AND lower(trim(regexp_replace(translate(t."driver", 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'), '\s+', ' ', 'g')))
		IN ('mingo', 'domingo', 'domingo siculo');
