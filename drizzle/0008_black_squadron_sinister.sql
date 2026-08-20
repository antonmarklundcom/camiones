-- Phase 6 Batch 4 — real foreign keys (audit F19).
--
-- Integrity was app-side only: a bad delete left listings pointing at a brand
-- that no longer existed and nothing complained until a page 500'd.
--
-- Policy: CASCADE where the child is meaningless without the parent (photos,
-- import rows); RESTRICT where deleting the parent would destroy business data
-- (a seller/brand/city still referenced by listings — the delete fails loudly
-- and a human decides); SET NULL for audit references and for leads/analytics,
-- which must OUTLIVE the listing they refer to.
--
-- ORPHAN CLEANUP FIRST. Adding a FK to a table that already has orphan rows
-- fails, and a half-applied migration is a bad afternoon. Nullable references
-- are nulled out below. The three NOT NULL ones on `listings`
-- (brand_id/location_id/seller_id) can't be nulled — if any of those are
-- orphaned the ALTER will fail, deliberately: fix or delete those listings by
-- hand first. To find them before migrating:
--
--   SELECT l.id, l.public_id FROM listings l
--     LEFT JOIN brands b    ON b.id = l.brand_id     WHERE b.id IS NULL
--   UNION SELECT l.id, l.public_id FROM listings l
--     LEFT JOIN locations o ON o.id = l.location_id  WHERE o.id IS NULL
--   UNION SELECT l.id, l.public_id FROM listings l
--     LEFT JOIN sellers s   ON s.id = l.seller_id    WHERE s.id IS NULL;

UPDATE `listings` l LEFT JOIN `users` u ON u.id = l.updated_by
  SET l.updated_by = NULL WHERE l.updated_by IS NOT NULL AND u.id IS NULL;--> statement-breakpoint
UPDATE `content_pages` c LEFT JOIN `users` u ON u.id = c.updated_by
  SET c.updated_by = NULL WHERE c.updated_by IS NOT NULL AND u.id IS NULL;--> statement-breakpoint
UPDATE `content_pages` c LEFT JOIN `brands` b ON b.id = c.brand_id
  SET c.brand_id = NULL WHERE c.brand_id IS NOT NULL AND b.id IS NULL;--> statement-breakpoint
UPDATE `fx_rates` f LEFT JOIN `users` u ON u.id = f.created_by
  SET f.created_by = NULL WHERE f.created_by IS NOT NULL AND u.id IS NULL;--> statement-breakpoint
UPDATE `users` us LEFT JOIN `sellers` s ON s.id = us.seller_id
  SET us.seller_id = NULL WHERE us.seller_id IS NOT NULL AND s.id IS NULL;--> statement-breakpoint
UPDATE `locations` lo LEFT JOIN `locations` par ON par.id = lo.parent_id
  SET lo.parent_id = NULL WHERE lo.parent_id IS NOT NULL AND par.id IS NULL;--> statement-breakpoint
UPDATE `leads` le LEFT JOIN `listings` l ON l.id = le.listing_id
  SET le.listing_id = NULL WHERE le.listing_id IS NOT NULL AND l.id IS NULL;--> statement-breakpoint
UPDATE `leads` le LEFT JOIN `sellers` s ON s.id = le.seller_id
  SET le.seller_id = NULL WHERE le.seller_id IS NOT NULL AND s.id IS NULL;--> statement-breakpoint
UPDATE `analytics_events` a LEFT JOIN `listings` l ON l.id = a.listing_id
  SET a.listing_id = NULL WHERE a.listing_id IS NOT NULL AND l.id IS NULL;--> statement-breakpoint
UPDATE `analytics_events` a LEFT JOIN `sellers` s ON s.id = a.seller_id
  SET a.seller_id = NULL WHERE a.seller_id IS NOT NULL AND s.id IS NULL;--> statement-breakpoint
UPDATE `analytics_daily` a LEFT JOIN `listings` l ON l.id = a.listing_id
  SET a.listing_id = NULL WHERE a.listing_id IS NOT NULL AND l.id IS NULL;--> statement-breakpoint
UPDATE `analytics_daily` a LEFT JOIN `sellers` s ON s.id = a.seller_id
  SET a.seller_id = NULL WHERE a.seller_id IS NOT NULL AND s.id IS NULL;--> statement-breakpoint
UPDATE `import_jobs` j LEFT JOIN `sellers` s ON s.id = j.seller_id
  SET j.seller_id = NULL WHERE j.seller_id IS NOT NULL AND s.id IS NULL;--> statement-breakpoint
UPDATE `import_rows` r LEFT JOIN `listings` l ON l.id = r.listing_id
  SET r.listing_id = NULL WHERE r.listing_id IS NOT NULL AND l.id IS NULL;--> statement-breakpoint
DELETE r FROM `import_rows` r LEFT JOIN `import_jobs` j ON j.id = r.job_id
  WHERE j.id IS NULL;--> statement-breakpoint
DELETE i FROM `images` i LEFT JOIN `listings` l ON l.id = i.listing_id
  WHERE l.id IS NULL;--> statement-breakpoint

ALTER TABLE `analytics_daily` ADD CONSTRAINT `analytics_daily_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `analytics_daily` ADD CONSTRAINT `analytics_daily_seller_id_sellers_id_fk` FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `analytics_events` ADD CONSTRAINT `analytics_events_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `analytics_events` ADD CONSTRAINT `analytics_events_seller_id_sellers_id_fk` FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_pages` ADD CONSTRAINT `content_pages_brand_id_brands_id_fk` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_pages` ADD CONSTRAINT `content_pages_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fx_rates` ADD CONSTRAINT `fx_rates_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `images` ADD CONSTRAINT `images_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `import_jobs` ADD CONSTRAINT `import_jobs_seller_id_sellers_id_fk` FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `import_rows` ADD CONSTRAINT `import_rows_job_id_import_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `import_jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `import_rows` ADD CONSTRAINT `import_rows_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_seller_id_sellers_id_fk` FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_brand_id_brands_id_fk` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_seller_id_sellers_id_fk` FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `locations` ADD CONSTRAINT `locations_parent_id_locations_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `locations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_seller_id_sellers_id_fk` FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON DELETE restrict ON UPDATE no action;