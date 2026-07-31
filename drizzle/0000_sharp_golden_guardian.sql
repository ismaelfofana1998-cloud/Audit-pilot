CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`mission_id` text,
	`actor_user_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_log_tenant_idx` ON `activity_log` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `activity_log_mission_idx` ON `activity_log` (`mission_id`);--> statement-breakpoint
CREATE TABLE `atomic_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`procedure_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`assigned_to_user_id` text,
	`reviewer_user_id` text,
	`due_date` text,
	`preparation_status` text DEFAULT 'not_started' NOT NULL,
	`prepared_by_user_id` text,
	`prepared_at` text,
	`conclusion` text,
	`evidence_link` text,
	`review_status` text DEFAULT 'not_started' NOT NULL,
	`reviewed_by_user_id` text,
	`reviewed_at` text,
	`review_note` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `audit_cycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`procedure_id`) REFERENCES `audit_procedures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prepared_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atomic_tests_mission_code_uq` ON `atomic_tests` (`mission_id`,`code`);--> statement-breakpoint
CREATE INDEX `atomic_tests_tenant_idx` ON `atomic_tests` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `atomic_tests_assignee_idx` ON `atomic_tests` (`assigned_to_user_id`);--> statement-breakpoint
CREATE INDEX `atomic_tests_reviewer_idx` ON `atomic_tests` (`reviewer_user_id`);--> statement-breakpoint
CREATE TABLE `audit_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text,
	`status` text DEFAULT 'not_started' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_cycles_mission_code_uq` ON `audit_cycles` (`mission_id`,`code`);--> statement-breakpoint
CREATE INDEX `audit_cycles_tenant_idx` ON `audit_cycles` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `audit_procedures` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`objective` text DEFAULT '' NOT NULL,
	`assertion` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `audit_cycles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_procedures_tenant_idx` ON `audit_procedures` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `audit_procedures_cycle_idx` ON `audit_procedures` (`cycle_id`);--> statement-breakpoint
CREATE TABLE `client_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`cycle_id` text,
	`title` text NOT NULL,
	`recipient_name` text,
	`recipient_email` text,
	`owner_user_id` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`planned_send_date` text,
	`due_date` text,
	`sent_at` text,
	`received_at` text,
	`email_link` text,
	`document_link` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `audit_cycles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `client_requests_tenant_idx` ON `client_requests` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `client_requests_mission_idx` ON `client_requests` (`mission_id`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`legal_form` text,
	`industry` text,
	`primary_contact_name` text,
	`primary_contact_email` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `clients_tenant_idx` ON `clients` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_role` text DEFAULT 'member' NOT NULL,
	`professional_grade` text DEFAULT 'junior' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_tenant_user_uq` ON `memberships` (`tenant_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `memberships_tenant_idx` ON `memberships` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `mission_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`author_user_id` text,
	`kind` text DEFAULT 'note' NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`due_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mission_notes_tenant_idx` ON `mission_notes` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `mission_notes_mission_idx` ON `mission_notes` (`mission_id`);--> statement-breakpoint
CREATE TABLE `mission_team` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`user_id` text NOT NULL,
	`engagement_role` text NOT NULL,
	`is_mission_lead` integer DEFAULT false NOT NULL,
	`can_review` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mission_team_mission_user_uq` ON `mission_team` (`mission_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `mission_team_tenant_idx` ON `mission_team` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `missions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`fiscal_year` text NOT NULL,
	`mission_type` text DEFAULT 'audit_legal' NOT NULL,
	`status` text DEFAULT 'planning' NOT NULL,
	`risk_level` text DEFAULT 'normal' NOT NULL,
	`closing_date` text,
	`interim_date` text,
	`final_date` text,
	`report_date` text,
	`ag_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `missions_tenant_idx` ON `missions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `missions_client_idx` ON `missions` (`client_id`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`timezone` text DEFAULT 'Europe/Paris' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_uq` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`avatar_initials` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uq` ON `users` (`email`);