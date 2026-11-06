CREATE TABLE "activity_events" (
	"id" text PRIMARY KEY,
	"user_id" text,
	"type" text NOT NULL,
	"feature" text NOT NULL,
	"status" text NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"correlation_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_accounts" (
	"id" text PRIMARY KEY,
	"email" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"verified_at" timestamp with time zone,
	"registered_at" timestamp with time zone,
	"last_login" timestamp with time zone,
	"last_active" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admin_audit" (
	"id" text PRIMARY KEY,
	"admin_id" text NOT NULL,
	"action" text NOT NULL,
	"target_id" text,
	"result" text NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_rate_limits" (
	"key" text PRIMARY KEY,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_state" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL
);
