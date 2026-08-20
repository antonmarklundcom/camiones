-- Phase 6 Batch 2 — import rebuild (audit F2 / F3 / F12 / F28).
--
-- Adds the import journal (import_jobs + import_rows, with previous_json as the
-- undo record) and the listings identity anchor (external_id = chapa or dealer
-- stock id, unique per seller).
--
-- NOTE ON EXISTING IMPORTED ROWS: importIdentity() now derives a v2 key, so any
-- listing imported by the OLD script will not match its CSV row and would be
-- re-created as a new draft. Nothing has been imported against a live DB yet;
-- if that ever changes, backfill `external_id` from the dealer sheet and
-- recompute `import_key` BEFORE the next run rather than re-importing blind.

CREATE TABLE `import_jobs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`seller_id` bigint unsigned,
	`seller_slug` varchar(180) NOT NULL,
	`file` varchar(500) NOT NULL,
	`file_sha1` char(40) NOT NULL,
	`mode` enum('dry-run','commit') NOT NULL,
	`anchored` boolean NOT NULL DEFAULT false,
	`publish_requested` boolean NOT NULL DEFAULT false,
	`rows_total` int unsigned NOT NULL DEFAULT 0,
	`rows_created` int unsigned NOT NULL DEFAULT 0,
	`rows_updated` int unsigned NOT NULL DEFAULT 0,
	`rows_skipped` int unsigned NOT NULL DEFAULT 0,
	`rows_errored` int unsigned NOT NULL DEFAULT 0,
	`status` enum('planned','committed','failed') NOT NULL DEFAULT 'planned',
	`notes` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`finished_at` datetime,
	CONSTRAINT `import_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_rows` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`job_id` bigint unsigned NOT NULL,
	`row_no` int unsigned NOT NULL,
	`action` enum('create','update','skip','error') NOT NULL,
	`import_key` char(40),
	`external_id` varchar(60),
	`listing_id` bigint unsigned,
	`changed_fields` varchar(500),
	`previous_json` text,
	`error` varchar(500),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `import_rows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `listings` ADD `external_id` varchar(60);--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `uq_seller_external` UNIQUE(`seller_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `idx_import_job_seller` ON `import_jobs` (`seller_slug`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_import_row_job` ON `import_rows` (`job_id`,`row_no`);