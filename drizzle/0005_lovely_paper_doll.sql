CREATE TABLE `analytics_daily` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`day` date NOT NULL,
	`kind` enum('page_view','wa_click','lead') NOT NULL,
	`listing_id` bigint unsigned,
	`seller_id` bigint unsigned,
	`events` int unsigned NOT NULL DEFAULT 0,
	`visitors` int unsigned NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `analytics_daily_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_daily` UNIQUE(`day`,`kind`,`listing_id`,`seller_id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`kind` enum('page_view','wa_click','lead') NOT NULL,
	`listing_id` bigint unsigned,
	`seller_id` bigint unsigned,
	`path` varchar(255),
	`referrer_host` varchar(120),
	`visitor_hash` char(32),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `listings` ADD `price_usd_prev` decimal(12,2);--> statement-breakpoint
ALTER TABLE `listings` ADD `price_changed_at` datetime;--> statement-breakpoint
ALTER TABLE `sellers` ADD `verified_at` datetime;--> statement-breakpoint
ALTER TABLE `sellers` ADD `verified_by` bigint unsigned;--> statement-breakpoint
ALTER TABLE `sellers` ADD `verified_note` varchar(255);--> statement-breakpoint
CREATE INDEX `idx_daily_seller` ON `analytics_daily` (`seller_id`,`day`);--> statement-breakpoint
CREATE INDEX `idx_daily_listing` ON `analytics_daily` (`listing_id`,`day`);--> statement-breakpoint
CREATE INDEX `idx_ev_rollup` ON `analytics_events` (`created_at`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_ev_listing` ON `analytics_events` (`listing_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ev_seller` ON `analytics_events` (`seller_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_price_sort` ON `listings` (`status`,`price_usd`);