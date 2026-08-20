-- Phase 6 Batch 1 remainder — leads write-ahead log (audit F1).
--
-- Leads were fire-and-forget: the contact form POSTed a webhook and kept
-- nothing, so an unset GHL_WEBHOOK_URL in production silently dropped every
-- enquiry while telling the buyer "gracias". The row is now written and
-- committed BEFORE any network call; delivery status lives on the row and the
-- cron sweep retries `pending` ones with backoff.
--
-- `idempotency_key` is unique so a double-click or a post-timeout retry
-- collapses onto one CRM contact instead of two.

CREATE TABLE `leads` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(140) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`message` text NOT NULL,
	`listing_id` bigint unsigned,
	`seller_id` bigint unsigned,
	`listing_public_id` char(10),
	`listing_title` varchar(180),
	`listing_url` varchar(500),
	`price_usd` decimal(12,2),
	`page_url` varchar(500),
	`referrer_host` varchar(120),
	`idempotency_key` varchar(100) NOT NULL,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`sink` varchar(30),
	`attempts` int unsigned NOT NULL DEFAULT 0,
	`last_error` varchar(500),
	`last_attempt_at` datetime,
	`sent_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `leads_idempotency_key_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_lead_delivery` ON `leads` (`status`,`last_attempt_at`);--> statement-breakpoint
CREATE INDEX `idx_lead_listing` ON `leads` (`listing_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_lead_seller` ON `leads` (`seller_id`,`created_at`);