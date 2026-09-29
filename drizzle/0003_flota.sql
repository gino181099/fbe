CREATE TABLE "driver" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "driver_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"phone" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicle_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"plate" text NOT NULL,
	"model" text NOT NULL,
	"seats" integer NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "vehicle_id" integer;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "driver_id" integer;--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "driver_id" integer;--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "vehicle_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_plate_idx" ON "vehicle" USING btree ("plate");--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_vehicle_idx" ON "expense" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "trip_driver_idx" ON "trip" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "trip_vehicle_idx" ON "trip" USING btree ("vehicle_id");--> statement-breakpoint
-- Seed idempotente de la flota (vehiculos.md / choferes.md).
INSERT INTO "vehicle" ("plate", "model", "seats") VALUES
	('AH115DL', 'Mercedes Benz Sprinter 517 CDI', 19),
	('AG225LD', 'Mercedes Benz Sprinter 517 CDI', 19),
	('AG632FM', 'Mercedes Benz Sprinter 414 CDI', 15),
	('AH465DS', 'Toyota Hiace', 13)
ON CONFLICT ("plate") DO NOTHING;--> statement-breakpoint
INSERT INTO "driver" ("name")
SELECT v.name FROM (VALUES ('Jose Vera'), ('Walter Fernandez'), ('Ricardo Nuñez'), ('Omar Vargas'), ('Sergio Zambudio')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM "driver" d WHERE lower(d."name") = lower(v.name));--> statement-breakpoint
-- Backfill de trip.driver_id: match sin mayúsculas/acentos/espacios extra por nombre completo,
-- nombre de pila o apellido (estos dos solo si identifican a un único chofer).
-- Textos como "Walter y Omar" o alias sin chofer ("Mingo") quedan solo como texto histórico.
WITH d AS (
	SELECT "id", lower(trim(regexp_replace(translate("name", 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'), '\s+', ' ', 'g'))) AS full_name
	FROM "driver"
), keys AS (
	SELECT "id", full_name AS k FROM d
	UNION SELECT "id", split_part(full_name, ' ', 1) FROM d
	UNION SELECT "id", regexp_replace(full_name, '^.* ', '') FROM d
), unique_keys AS (
	SELECT k, min("id") AS "id" FROM keys GROUP BY k HAVING count(DISTINCT "id") = 1
)
UPDATE "trip" t SET "driver_id" = u."id"
FROM unique_keys u
WHERE t."driver_id" IS NULL
	AND t."driver" IS NOT NULL
	AND lower(trim(regexp_replace(translate(t."driver", 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'), '\s+', ' ', 'g'))) = u.k;
