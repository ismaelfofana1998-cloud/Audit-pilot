CREATE TABLE `circularisations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`type` text NOT NULL,
	`third_party_name` text NOT NULL,
	`contact_email` text,
	`owner_user_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`sent_at` text,
	`response_at` text,
	`next_follow_up_at` text,
	`alternative_procedure` text,
	`evidence_link` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `circularisations_tenant_idx` ON `circularisations` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `circularisations_mission_idx` ON `circularisations` (`mission_id`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`access_role` text DEFAULT 'member' NOT NULL,
	`professional_grade` text DEFAULT 'junior' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by_user_id` text,
	`accepted_at` text,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_tenant_email_uq` ON `invitations` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `invitations_email_idx` ON `invitations` (`email`);--> statement-breakpoint
CREATE TABLE `mission_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'task' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`assigned_to_user_id` text,
	`due_date` text,
	`source_anchor` text,
	`offset_days` integer,
	`is_date_locked` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mission_tasks_tenant_idx` ON `mission_tasks` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `mission_tasks_mission_idx` ON `mission_tasks` (`mission_id`);--> statement-breakpoint
CREATE INDEX `mission_tasks_assignee_idx` ON `mission_tasks` (`assigned_to_user_id`);--> statement-breakpoint
CREATE TABLE `request_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` text NOT NULL,
	`request_id` text NOT NULL,
	`actor_user_id` text,
	`event_type` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`request_id`) REFERENCES `client_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `request_events_tenant_idx` ON `request_events` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `request_events_request_idx` ON `request_events` (`request_id`);