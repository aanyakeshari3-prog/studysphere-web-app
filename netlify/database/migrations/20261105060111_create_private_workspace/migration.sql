CREATE TABLE "documents" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" integer NOT NULL,
	"notebook_id" text DEFAULT '' NOT NULL,
	"extracted_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"user_id" text PRIMARY KEY,
	"revision" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
