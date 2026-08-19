CREATE TABLE `leads` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`idempotency_key` varchar(100) NOT NULL,
	`name` varchar(140) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`message` varchar(1000) NOT NULL,
	`listing_id` bigint unsigned,
	`seller_id` bigint unsigned,
	`page_url` varchar(2000),
	`referrer` varchar(2000),
	`utm_source` varchar(200),
	`utm_medium` varchar(200),
	`utm_campaign` varchar(200),
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`attempts` tinyint unsigned NOT NULL DEFAULT 0,
	`last_error` varchar(500),
	`crm_contact_id` varchar(64),
	`crm_deal_id` varchar(64),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`sent_at` datetime,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `leads_idempotency_key_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_status` ON `leads` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_listing` ON `leads` (`listing_id`);