CREATE TABLE `import_jobs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`source_file` varchar(300) NOT NULL,
	`seller_slug` varchar(180) NOT NULL,
	`seller_id` bigint unsigned,
	`mode` enum('dry_run','commit') NOT NULL DEFAULT 'dry_run',
	`flags` varchar(300) NOT NULL DEFAULT '',
	`anchored` boolean NOT NULL DEFAULT false,
	`status` enum('running','ok','partial','failed','blocked') NOT NULL DEFAULT 'running',
	`rows_total` int unsigned NOT NULL DEFAULT 0,
	`rows_created` int unsigned NOT NULL DEFAULT 0,
	`rows_updated` int unsigned NOT NULL DEFAULT 0,
	`rows_skipped` int unsigned NOT NULL DEFAULT 0,
	`rows_error` int unsigned NOT NULL DEFAULT 0,
	`message` text,
	`started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
	`external_id` varchar(120),
	`listing_id` bigint unsigned,
	`changed` varchar(500),
	`message` text,
	`previous_json` text,
	`next_json` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `import_rows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `listings` ADD `external_id` varchar(120);--> statement-breakpoint
CREATE INDEX `idx_job_seller` ON `import_jobs` (`seller_slug`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_row_job` ON `import_rows` (`job_id`,`row_no`);--> statement-breakpoint
CREATE INDEX `idx_external` ON `listings` (`seller_id`,`external_id`);