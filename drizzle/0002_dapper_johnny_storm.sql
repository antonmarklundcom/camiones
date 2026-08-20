-- F20: backfill before the NOT NULL tightening, so the ALTER can't fail
-- half-way through on legacy rows. Both placeholders are DELIBERATELY unusable:
-- '@invalid.local' is a reserved non-routable TLD and '!disabled' is not a
-- valid bcrypt hash, so bcrypt.compare() always returns false. Such rows show
-- up as obviously broken in /admin/users and must be fixed or deleted by hand.
UPDATE `users` SET `email` = CONCAT('sin-email-', `id`, '@invalid.local') WHERE `email` IS NULL;--> statement-breakpoint
UPDATE `users` SET `password_hash` = '!disabled' WHERE `password_hash` IS NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(190) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `password_hash` varchar(255) NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_brand_fresh` ON `listings` (`status`,`brand_id`,`featured`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_city_fresh` ON `listings` (`status`,`location_id`,`featured`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_cat_fresh` ON `listings` (`status`,`category`,`featured`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_condition_fresh` ON `listings` (`status`,`condition`,`featured`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_seller_fresh` ON `listings` (`status`,`seller_id`,`featured`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_year` ON `listings` (`status`,`year`);--> statement-breakpoint
CREATE INDEX `idx_km` ON `listings` (`status`,`km`);--> statement-breakpoint
CREATE INDEX `idx_transmission` ON `listings` (`status`,`transmission`);--> statement-breakpoint
CREATE INDEX `idx_traction` ON `listings` (`status`,`traction`);