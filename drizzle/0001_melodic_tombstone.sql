CREATE TABLE `content_pages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(180) NOT NULL,
	`kind` enum('guia','marca','categoria') NOT NULL DEFAULT 'guia',
	`title` varchar(200) NOT NULL,
	`excerpt` varchar(320),
	`body` text NOT NULL,
	`hero_r2_key` varchar(500),
	`brand_id` bigint unsigned,
	`category` enum('camion','tractocamion','furgon','volquete','frigorifico','camioneta','bus'),
	`source` varchar(40) NOT NULL DEFAULT 'manual',
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`published_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_by` bigint unsigned,
	CONSTRAINT `content_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_pages_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `idx_content_list` ON `content_pages` (`status`,`kind`,`published_at`);