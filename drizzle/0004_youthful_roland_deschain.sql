CREATE TABLE `fx_rates` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`base` char(3) NOT NULL DEFAULT 'USD',
	`quote` char(3) NOT NULL DEFAULT 'PYG',
	`rate` decimal(14,4) NOT NULL,
	`source` varchar(140) NOT NULL DEFAULT 'manual',
	`note` varchar(255),
	`active` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`created_by` bigint unsigned,
	CONSTRAINT `fx_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `financing_programs` ADD `rate_convention` enum('tea','nominal') DEFAULT 'tea' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_fx_active` ON `fx_rates` (`base`,`quote`,`active`,`created_at`);