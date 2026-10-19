CREATE TABLE "supplier_payment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_payment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"supplier_id" integer NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"method" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"cuit" text,
	"invoices" boolean DEFAULT true NOT NULL,
	"category" text,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "supplier_id" integer;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "paid" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_payment_supplier_date_idx" ON "supplier_payment" USING btree ("supplier_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_name_idx" ON "supplier" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_supplier_idx" ON "expense" USING btree ("supplier_id");--> statement-breakpoint
-- Backfill T-021 (idempotente: ON CONFLICT sobre lower(name) y UPDATE solo donde supplier_id es null; no toca montos).
INSERT INTO "supplier" ("name", "category") VALUES ('Axion Sarmiento', 'Combustible'), ('Shell Maza', 'Combustible') ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "supplier" ("name", "category")
SELECT DISTINCT ON (lower(n)) n, 'Combustible' FROM (
  SELECT trim("fuel_supplier") AS n FROM "trip"
  UNION SELECT trim("supplier") FROM "fuel_load"
  UNION SELECT trim("supplier") FROM "expense" WHERE "category" = 'combustible'
) x WHERE n IS NOT NULL AND n <> '' ORDER BY lower(n), n
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "supplier" ("name")
SELECT DISTINCT ON (lower(trim("supplier"))) trim("supplier") FROM "expense"
WHERE "supplier" IS NOT NULL AND trim("supplier") <> '' ORDER BY lower(trim("supplier")), trim("supplier")
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "expense" SET "supplier_id" = s."id" FROM "supplier" s
WHERE lower(s."name") = lower(trim("expense"."supplier")) AND "expense"."supplier_id" IS NULL;
