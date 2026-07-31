ALTER TABLE `atomic_tests` RENAME TO `audit_tests`;
--> statement-breakpoint
DROP INDEX IF EXISTS `atomic_tests_mission_code_uq`;
--> statement-breakpoint
DROP INDEX IF EXISTS `atomic_tests_tenant_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `atomic_tests_assignee_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `atomic_tests_reviewer_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_tests_mission_code_uq` ON `audit_tests` (`mission_id`,`code`);
--> statement-breakpoint
CREATE INDEX `audit_tests_tenant_idx` ON `audit_tests` (`tenant_id`);
--> statement-breakpoint
CREATE INDEX `audit_tests_assignee_idx` ON `audit_tests` (`assigned_to_user_id`);
--> statement-breakpoint
CREATE INDEX `audit_tests_reviewer_idx` ON `audit_tests` (`reviewer_user_id`);
