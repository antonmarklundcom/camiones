-- Batch 1 (F1 leads write-ahead log, F14 filter indexes, F20 users NOT NULL).
-- BEFORE RUNNING on an existing DB: the two users MODIFY statements fail if any
-- row has a NULL email or password_hash. Check first and backfill/delete:
--   select id, email from users where email is null or password_hash is null;

CREATE TABLE `leads` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(140) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`message` text NOT NULL,
	`listing_id` bigint unsigned,
	`listing_public_id` char(10),
	`listing_title` varchar(180),
	`listing_url` varchar(300),
	`listing_price_usd` decimal(12,2),
	`seller_id` bigint unsigned,
	`seller_slug` varchar(180),
	`delivery` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`attempts` tinyint unsigned NOT NULL DEFAULT 0,
	`last_error` varchar(255),
	`delivered_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(190) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `password_hash` varchar(255) NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_delivery` ON `leads` (`delivery`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_lead_listing` ON `leads` (`listing_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_brand_fresh` ON `listings` (`status`,`brand_id`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_city_fresh` ON `listings` (`status`,`location_id`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_condition_fresh` ON `listings` (`status`,`condition`,`published_at`);