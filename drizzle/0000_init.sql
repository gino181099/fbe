CREATE TYPE "public"."client_status" AS ENUM('activo', 'potencial', 'inactivo');--> statement-breakpoint
CREATE TYPE "public"."client_type" AS ENUM('recurrente', 'especial');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('combustible', 'sueldo', 'varios');--> statement-breakpoint
CREATE TYPE "public"."permission_level" AS ENUM('none', 'view', 'edit');--> statement-breakpoint
CREATE TYPE "public"."module" AS ENUM('contactos', 'ventas', 'finanzas', 'usuarios');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'disabled');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "client_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"type" "client_type" DEFAULT 'especial' NOT NULL,
	"status" "client_status" DEFAULT 'activo' NOT NULL,
	"cuit" text,
	"contact_person" text,
	"phone" text,
	"email" text,
	"address" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"client_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"method" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"category" "expense_category" NOT NULL,
	"concept" text,
	"amount" numeric(14, 2) NOT NULL,
	"notes" text,
	"legacy_source" text,
	"legacy_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_load" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fuel_load_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"pesos" numeric(14, 2) NOT NULL,
	"liters" numeric(10, 2),
	"notes" text,
	"legacy_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fuel_load_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"user_id" text NOT NULL,
	"module" "module" NOT NULL,
	"level" "permission_level" DEFAULT 'none' NOT NULL,
	CONSTRAINT "permission_user_id_module_pk" PRIMARY KEY("user_id","module")
);
--> statement-breakpoint
CREATE TABLE "rate" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rate_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" integer NOT NULL,
	"route_id" integer NOT NULL,
	"capacity" integer NOT NULL,
	"price" numeric(14, 2) NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date
);
--> statement-breakpoint
CREATE TABLE "route" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "route_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	CONSTRAINT "route_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trip_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"client_id" integer NOT NULL,
	"route_id" integer,
	"route_text" text,
	"passengers" integer,
	"capacity" integer,
	"rate_id" integer,
	"price" numeric(14, 2) DEFAULT 0 NOT NULL,
	"driver" text,
	"driver_pay" numeric(14, 2),
	"fuel_pesos" numeric(14, 2),
	"fuel_liters" numeric(10, 2),
	"extra_payments" numeric(14, 2),
	"notes" text,
	"legacy_source" text,
	"legacy_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"username" text,
	"password_hash" text,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission" ADD CONSTRAINT "permission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate" ADD CONSTRAINT "rate_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate" ADD CONSTRAINT "rate_route_id_route_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."route"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_route_id_route_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."route"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip" ADD CONSTRAINT "trip_rate_id_rate_id_fk" FOREIGN KEY ("rate_id") REFERENCES "public"."rate"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_client_idx" ON "collection" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "expense_date_idx" ON "expense" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_legacy_idx" ON "expense" USING btree ("legacy_source","legacy_id");--> statement-breakpoint
CREATE INDEX "rate_lookup_idx" ON "rate" USING btree ("client_id","route_id","capacity");--> statement-breakpoint
CREATE INDEX "trip_date_idx" ON "trip" USING btree ("date");--> statement-breakpoint
CREATE INDEX "trip_client_idx" ON "trip" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_legacy_idx" ON "trip" USING btree ("legacy_source","legacy_id");