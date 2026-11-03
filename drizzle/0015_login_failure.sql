CREATE TABLE "login_failure" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "login_failure_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ip" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "login_failure_ip_idx" ON "login_failure" USING btree ("ip","created_at");