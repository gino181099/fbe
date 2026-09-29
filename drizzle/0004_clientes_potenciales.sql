CREATE TYPE "public"."lead_stage" AS ENUM('sin_contactar', 'contactado', 'ganado', 'perdido');--> statement-breakpoint
ALTER TYPE "public"."client_type" ADD VALUE 'potencial';--> statement-breakpoint
CREATE TABLE "client_note" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "client_note_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" integer NOT NULL,
	"date" date NOT NULL,
	"text" text NOT NULL,
	"auto" boolean DEFAULT false NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "lead_stage" "lead_stage";--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "segment" text;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "lead_priority" text;--> statement-breakpoint
ALTER TABLE "client_note" ADD CONSTRAINT "client_note_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_note" ADD CONSTRAINT "client_note_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_note_client_idx" ON "client_note" USING btree ("client_id","date");--> statement-breakpoint
UPDATE "client" SET "lead_stage" = 'sin_contactar' WHERE "status" = 'potencial' AND "lead_stage" IS NULL;
