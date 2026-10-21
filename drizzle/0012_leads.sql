CREATE TYPE "public"."opportunity_stage" AS ENUM('nuevo', 'contacto', 'propuesta', 'ganado', 'perdido');--> statement-breakpoint
CREATE TABLE "lead_note" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lead_note_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"lead_id" integer NOT NULL,
	"date" date NOT NULL,
	"text" text NOT NULL,
	"auto" boolean DEFAULT false NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lead_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"client_id" integer,
	"company" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"email" text,
	"website" text,
	"address" text,
	"segment" text,
	"priority" text,
	"stage" "opportunity_stage" DEFAULT 'nuevo' NOT NULL,
	"expected_amount" numeric(14, 2),
	"expected_close" date,
	"owner_id" text,
	"next_action" text,
	"next_action_date" date,
	"lost_reason" text,
	"notes" text,
	"closed_at" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_note_lead_idx" ON "lead_note" USING btree ("lead_id","date");--> statement-breakpoint
CREATE INDEX "lead_stage_idx" ON "lead" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "lead_client_idx" ON "lead" USING btree ("client_id");--> statement-breakpoint
-- Backfill: cada contacto que pasó por el embudo (T-015) pasa a ser un lead vinculado (no se borra nada).
INSERT INTO "lead" ("title", "client_id", "company", "contact_person", "phone", "email", "website", "address", "segment", "priority", "stage", "notes", "closed_at", "created_at")
SELECT c."name", c."id", c."name", c."contact_person", c."phone", c."email", c."website", c."address", c."segment", c."lead_priority",
  (CASE c."lead_stage" WHEN 'sin_contactar' THEN 'nuevo' WHEN 'contactado' THEN 'contacto' ELSE c."lead_stage"::text END)::"opportunity_stage",
  c."notes",
  CASE WHEN c."lead_stage" IN ('ganado', 'perdido') THEN c."updated_at"::date END,
  c."created_at"
FROM "client" c
WHERE c."lead_stage" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "lead" l WHERE l."client_id" = c."id");--> statement-breakpoint
INSERT INTO "lead_note" ("lead_id", "date", "text", "auto", "user_id", "created_at")
SELECT l."id", n."date", n."text", n."auto", n."user_id", n."created_at"
FROM "client_note" n
JOIN "lead" l ON l."client_id" = n."client_id"
WHERE NOT EXISTS (SELECT 1 FROM "lead_note" x WHERE x."lead_id" = l."id" AND x."text" = n."text" AND x."date" = n."date");--> statement-breakpoint
-- Permiso del módulo nuevo: el mismo nivel que cada usuario tiene en Contactos.
INSERT INTO "permission" ("user_id", "module", "level")
SELECT p."user_id", 'leads', p."level" FROM "permission" p WHERE p."module" = 'contactos'
ON CONFLICT DO NOTHING;
