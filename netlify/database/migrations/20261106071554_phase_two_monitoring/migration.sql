CREATE TABLE "monitor_events" (
	"id" text PRIMARY KEY,
	"user_id" text,
	"category" text NOT NULL,
	"feature" text NOT NULL,
	"provider" text,
	"model" text,
	"status" text NOT NULL,
	"http_status" integer,
	"duration_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_tokens" integer,
	"bytes" integer,
	"file_type" text,
	"code" text,
	"environment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_issues" (
	"id" text PRIMARY KEY,
	"fingerprint" text NOT NULL UNIQUE,
	"kind" text NOT NULL,
	"category" text NOT NULL,
	"feature" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"http_status" integer,
	"environment" text NOT NULL,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"read_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "monitor_events_category_time_idx" ON "monitor_events" ("category","created_at");--> statement-breakpoint
CREATE INDEX "monitor_events_user_time_idx" ON "monitor_events" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "monitor_issues_kind_time_idx" ON "monitor_issues" ("kind","last_seen");