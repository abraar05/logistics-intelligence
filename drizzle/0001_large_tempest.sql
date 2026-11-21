ALTER TABLE `sync_sources` ADD `accessTokenEnc` text;--> statement-breakpoint
ALTER TABLE `sync_sources` ADD `refreshTokenEnc` text;--> statement-breakpoint
ALTER TABLE `sync_sources` ADD `tokenExpiresAt` bigint;