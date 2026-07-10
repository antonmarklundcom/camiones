CREATE TABLE `brands` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'published',
	`published_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`),
	CONSTRAINT `brands_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `financing_programs` (
	`code` varchar(40) NOT NULL,
	`name` varchar(140) NOT NULL,
	`annual_rate` decimal(5,2) NOT NULL,
	`max_term_months` smallint NOT NULL,
	`max_amount_gs` decimal(14,0),
	`min_down_pct` decimal(5,2) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`status` enum('draft','published') NOT NULL DEFAULT 'published',
	`published_at` datetime,
	`updated_at` datetime,
	CONSTRAINT `financing_programs_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`listing_id` bigint unsigned NOT NULL,
	`r2_key` varchar(500) NOT NULL,
	`sort_order` tinyint unsigned NOT NULL DEFAULT 0,
	`alt` varchar(180),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` char(10) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`title` varchar(180) NOT NULL,
	`condition` enum('nuevo','usado') NOT NULL,
	`category` enum('camion','tractocamion','furgon','volquete','frigorifico','camioneta','bus') NOT NULL,
	`brand_id` bigint unsigned NOT NULL,
	`model` varchar(120) NOT NULL,
	`year` smallint unsigned NOT NULL,
	`km` int unsigned NOT NULL DEFAULT 0,
	`price_usd` decimal(12,2) NOT NULL,
	`price_gs` decimal(14,0) NOT NULL,
	`cuota_gs` decimal(14,0),
	`transmission` enum('manual','automatica','automatizada') NOT NULL,
	`fuel` enum('diesel','nafta','electrico','hibrido') NOT NULL DEFAULT 'diesel',
	`traction` enum('4x2','4x4','6x2','6x4','8x2','8x4') NOT NULL DEFAULT '4x2',
	`capacity_kg` int unsigned,
	`description` text,
	`location_id` bigint unsigned NOT NULL,
	`seller_id` bigint unsigned NOT NULL,
	`featured` boolean NOT NULL DEFAULT false,
	`import_key` char(40),
	`status` enum('draft','published','paused','sold','removed') NOT NULL DEFAULT 'draft',
	`published_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_by` bigint unsigned,
	CONSTRAINT `listings_id` PRIMARY KEY(`id`),
	CONSTRAINT `listings_public_id_unique` UNIQUE(`public_id`),
	CONSTRAINT `listings_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `listings_import_key_unique` UNIQUE(`import_key`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`parent_id` bigint unsigned,
	`level` enum('pais','departamento','ciudad') NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`full_slug` varchar(300) NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'published',
	`published_at` datetime,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `locations_full_slug_unique` UNIQUE(`full_slug`)
);
--> statement-breakpoint
CREATE TABLE `sellers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`type` enum('dealer','particular') NOT NULL DEFAULT 'dealer',
	`phone_whatsapp` varchar(30),
	`phone_display` varchar(40),
	`email` varchar(190),
	`address` varchar(255),
	`location_id` bigint unsigned,
	`description` text,
	`logo_r2_key` varchar(500),
	`status` enum('draft','published') NOT NULL DEFAULT 'published',
	`published_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sellers_id` PRIMARY KEY(`id`),
	CONSTRAINT `sellers_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(140),
	`email` varchar(190),
	`password_hash` varchar(255),
	`role` enum('admin','dealer') NOT NULL DEFAULT 'dealer',
	`seller_id` bigint unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `idx_listing` ON `images` (`listing_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_search` ON `listings` (`status`,`category`,`brand_id`,`location_id`,`price_usd`);--> statement-breakpoint
CREATE INDEX `idx_fresh` ON `listings` (`status`,`featured`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_seller` ON `listings` (`seller_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_brand` ON `listings` (`brand_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_parent` ON `locations` (`parent_id`,`level`);--> statement-breakpoint
CREATE INDEX `idx_location` ON `sellers` (`location_id`);