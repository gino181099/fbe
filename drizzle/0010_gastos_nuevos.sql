CREATE TYPE "public"."expense_scope" AS ENUM('general', 'vehiculo');--> statement-breakpoint
CREATE TYPE "public"."expense_voucher_type" AS ENUM('factura_a', 'factura_b', 'factura_c', 'recibo', 'ticket', 'sin_comprobante');--> statement-breakpoint
ALTER TABLE "expense" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
-- T-022: mapeo de categorías viejas (sueldo → personal; varios → vehiculo si tiene vehículo, si no generales).
UPDATE "expense" SET "category" = CASE
  WHEN "category" = 'sueldo' THEN 'personal'
  WHEN "category" = 'varios' AND "vehicle_id" IS NOT NULL THEN 'vehiculo'
  WHEN "category" = 'varios' THEN 'generales'
  ELSE "category" END
WHERE "category" IN ('sueldo', 'varios');--> statement-breakpoint
DROP TYPE "public"."expense_category";--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('vehiculo', 'personal', 'generales', 'combustible');--> statement-breakpoint
ALTER TABLE "expense" ALTER COLUMN "category" SET DATA TYPE "public"."expense_category" USING "category"::"public"."expense_category";--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "scope" "expense_scope" DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "subcategory" text;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "voucher_type" "expense_voucher_type" DEFAULT 'sin_comprobante' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "voucher_number" text;--> statement-breakpoint
-- T-022: backfill del alcance (antes del check).
UPDATE "expense" SET "scope" = 'vehiculo' WHERE "vehicle_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_scope_vehicle_check" CHECK (("expense"."scope" = 'vehiculo') = ("expense"."vehicle_id" is not null));