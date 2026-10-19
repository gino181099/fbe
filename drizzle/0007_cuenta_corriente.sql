CREATE TYPE "public"."document_type" AS ENUM('factura', 'interno', 'nota_debito', 'nota_credito', 'bonificacion', 'saldo_inicial');--> statement-breakpoint
CREATE TABLE "document_item" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"document_id" integer NOT NULL,
	"trip_id" integer,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "document_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" "document_type" NOT NULL,
	"letter" text,
	"pos" integer,
	"number" integer,
	"date" date NOT NULL,
	"due_date" date,
	"client_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"related_document_id" integer,
	"notes" text,
	"voided_at" timestamp,
	"voided_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "payment_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "document_item" ADD CONSTRAINT "document_item_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_item" ADD CONSTRAINT "document_item_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_related_document_id_document_id_fk" FOREIGN KEY ("related_document_id") REFERENCES "public"."document"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_item_document_idx" ON "document_item" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_item_trip_idx" ON "document_item" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_number_idx" ON "document" USING btree ("type","letter","pos","number");--> statement-breakpoint
CREATE INDEX "document_client_date_idx" ON "document" USING btree ("client_id","date");