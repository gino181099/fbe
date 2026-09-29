CREATE TYPE "public"."collection_kind" AS ENUM('cobro', 'ajuste');--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN "kind" "collection_kind" DEFAULT 'cobro' NOT NULL;--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN "period" text;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_source_idx" ON "collection" USING btree ("client_id","source","period");