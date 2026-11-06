CREATE INDEX "activity_events_time_idx" ON "activity_events" ("created_at");--> statement-breakpoint
CREATE INDEX "activity_events_user_time_idx" ON "activity_events" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_feature_time_idx" ON "activity_events" ("feature","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_type_time_idx" ON "activity_events" ("type","created_at");--> statement-breakpoint
CREATE INDEX "admin_accounts_registered_idx" ON "admin_accounts" ("registered_at");--> statement-breakpoint
CREATE INDEX "admin_accounts_status_role_idx" ON "admin_accounts" ("status","role");--> statement-breakpoint
CREATE INDEX "admin_accounts_email_idx" ON "admin_accounts" ("email");--> statement-breakpoint
CREATE INDEX "admin_accounts_active_idx" ON "admin_accounts" ("last_active");--> statement-breakpoint
CREATE INDEX "admin_audit_time_idx" ON "admin_audit" ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_admin_time_idx" ON "admin_audit" ("admin_id","created_at");