ALTER TABLE "expense" ADD COLUMN "supplier" text;--> statement-breakpoint
ALTER TABLE "fuel_load" ADD COLUMN "supplier" text;--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "fuel_supplier" text;--> statement-breakpoint
-- Datos históricos: todo el combustible se cargaba en Axion Sarmiento…
UPDATE "trip" SET "fuel_supplier" = 'Axion Sarmiento' WHERE "fuel_pesos" IS NOT NULL AND "fuel_pesos" <> 0;--> statement-breakpoint
UPDATE "fuel_load" SET "supplier" = 'Axion Sarmiento';--> statement-breakpoint
UPDATE "expense" SET "supplier" = 'Axion Sarmiento' WHERE "category" = 'combustible';--> statement-breakpoint
-- …salvo los pagos a Shell que estaban en Pagos_Varios.
UPDATE "expense" SET "category" = 'combustible', "supplier" = 'Shell Maza', "concept" = 'Carga de combustible'
WHERE "legacy_source" = 'Pagos_Varios' AND "concept" = 'Shell';
