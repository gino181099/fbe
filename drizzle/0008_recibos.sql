CREATE TABLE "receipt_trip" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "receipt_trip_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"receipt_id" integer NOT NULL,
	"trip_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "receipt_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" integer NOT NULL,
	"date" date NOT NULL,
	"client_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"method" text,
	"notes" text,
	"voided_at" timestamp,
	"voided_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "receipt_trip" ADD CONSTRAINT "receipt_trip_receipt_id_receipt_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_trip" ADD CONSTRAINT "receipt_trip_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receipt_trip_receipt_idx" ON "receipt_trip" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "receipt_trip_trip_idx" ON "receipt_trip" USING btree ("trip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_number_idx" ON "receipt" USING btree ("number");--> statement-breakpoint
CREATE INDEX "receipt_client_date_idx" ON "receipt" USING btree ("client_id","date");