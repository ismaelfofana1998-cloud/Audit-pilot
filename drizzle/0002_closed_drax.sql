CREATE TABLE `test_status_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`stage` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`color` text DEFAULT 'neutral' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_terminal` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `test_status_tenant_stage_code_uq` ON `test_status_definitions` (`tenant_id`,`stage`,`code`);--> statement-breakpoint
CREATE INDEX `test_status_tenant_idx` ON `test_status_definitions` (`tenant_id`);