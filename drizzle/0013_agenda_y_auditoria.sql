CREATE TYPE "public"."activity_type" AS ENUM('tarea', 'llamada', 'reunion', 'seguimiento', 'pago', 'mantenimiento');--> statement-breakpoint
CREATE TABLE "activity" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" "activity_type" DEFAULT 'tarea' NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"due_date" date NOT NULL,
	"assigned_to" text NOT NULL,
	"client_id" integer,
	"lead_id" integer,
	"vehicle_id" integer,
	"supplier_id" integer,
	"done_at" timestamp,
	"done_by" text,
	"done_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "driver" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "driver" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "driver" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "fuel_load" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "fuel_load" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "fuel_load" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "rate" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "rate" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "receipt" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "receipt" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "receipt" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "supplier_payment" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "supplier_payment" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "supplier_payment" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_done_by_user_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_assigned_idx" ON "activity" USING btree ("assigned_to","done_at","due_date");--> statement-breakpoint
CREATE INDEX "activity_client_idx" ON "activity" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "activity_lead_idx" ON "activity" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "activity_vehicle_idx" ON "activity" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "activity_supplier_idx" ON "activity" USING btree ("supplier_id");--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver" ADD CONSTRAINT "driver_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver" ADD CONSTRAINT "driver_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_load" ADD CONSTRAINT "fuel_load_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_load" ADD CONSTRAINT "fuel_load_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate" ADD CONSTRAINT "rate_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- T-025: el usuario compartido "frabel" pasa a ser Gino (conserva su id: notas y lo cargado hasta hoy quedan a su nombre).
UPDATE "user" SET "username" = 'gino', "name" = 'Gino' WHERE "username" = 'frabel' AND NOT EXISTS (SELECT 1 FROM "user" WHERE "username" = 'gino');--> statement-breakpoint
INSERT INTO "user" ("id", "username", "name", "status", "is_admin") VALUES
  (gen_random_uuid()::text, 'gino', 'Gino', 'active', true),
  (gen_random_uuid()::text, 'gianella', 'Gianella', 'active', true),
  (gen_random_uuid()::text, 'ale', 'Ale', 'active', true),
  (gen_random_uuid()::text, 'mingo', 'Mingo', 'active', true)
ON CONFLICT ("username") DO NOTHING;--> statement-breakpoint
UPDATE "client" SET "created_by" = (SELECT "id" FROM "user" WHERE "username" = 'gino');--> statement-breakpoint
UPDATE "lead" SET "created_by" = (SELECT "id" FROM "user" WHERE "username" = 'gino');--> statement-breakpoint
UPDATE "rate" SET "created_by" = (SELECT "id" FROM "user" WHERE "username" = 'gino');--> statement-breakpoint
UPDATE "driver" SET "created_by" = (SELECT "id" FROM "user" WHERE "username" = 'gino');--> statement-breakpoint
UPDATE "vehicle" SET "created_by" = (SELECT "id" FROM "user" WHERE "username" = 'gino');--> statement-breakpoint
UPDATE "trip" SET "created_by" = (SELECT "id" FROM "user" WHERE "username" = 'gino');--> statement-breakpoint
UPDATE "document" SET "created_by" = (SELECT "id" FROM "user" WHERE "username" = 'gino');--> statement-breakpoint
UPDATE "receipt" SET "created_by" = (SELECT "id" FROM "user" WHERE "username" = 'gino');--> statement-breakpoint
UPDATE "supplier" SET "created_by" = (SELECT "id" FROM "user" WHERE "username" = 'gino');--> statement-breakpoint
UPDATE "supplier_payment" SET "created_by" = (SELECT "id" FROM "user" WHERE "username" = 'gino');--> statement-breakpoint
UPDATE "expense" SET "created_by" = (SELECT "id" FROM "user" WHERE "username" = 'gino');--> statement-breakpoint
UPDATE "fuel_load" SET "created_by" = (SELECT "id" FROM "user" WHERE "username" = 'gino');