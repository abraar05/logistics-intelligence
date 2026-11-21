CREATE TABLE `import_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceType` varchar(32) NOT NULL,
	`sourceName` varchar(255) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'processing',
	`rowCount` int NOT NULL DEFAULT 0,
	`acceptedCount` int NOT NULL DEFAULT 0,
	`rejectedCount` int NOT NULL DEFAULT 0,
	`errorSummary` text,
	`createdAt` bigint NOT NULL,
	`completedAt` bigint,
	CONSTRAINT `import_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ledger_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`unitId` int NOT NULL,
	`importRunId` int,
	`eventType` varchar(64) NOT NULL,
	`eventAt` bigint,
	`state` varchar(64),
	`location` varchar(100),
	`party` varchar(180),
	`courier` varchar(100),
	`sourceSheet` varchar(180),
	`rawEvidence` text,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `ledger_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ledger_units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`imei` varchar(32) NOT NULL,
	`sku` varchar(180),
	`modelFamily` varchar(120),
	`color` varchar(80),
	`lot` varchar(180),
	`location` varchar(100),
	`currentState` varchar(64),
	`qualityScore` int NOT NULL DEFAULT 0,
	`riskScore` int NOT NULL DEFAULT 0,
	`lastEventAt` bigint,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `ledger_units_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `signal_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`severity` varchar(24) NOT NULL,
	`title` varchar(180) NOT NULL,
	`evidence` text NOT NULL,
	`recommendedAction` text NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`status` varchar(24) NOT NULL DEFAULT 'open',
	`ownerName` varchar(120),
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `signal_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(32) NOT NULL,
	`label` varchar(180) NOT NULL,
	`externalId` varchar(180),
	`spreadsheetUrl` text,
	`status` varchar(32) NOT NULL DEFAULT 'configured',
	`authMode` varchar(32) NOT NULL DEFAULT 'public_csv',
	`lastSyncedAt` bigint,
	`rowCount` int NOT NULL DEFAULT 0,
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `sync_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `import_runs_user_created_idx` ON `import_runs` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ledger_events_unit_event_idx` ON `ledger_events` (`userId`,`unitId`,`eventAt`);--> statement-breakpoint
CREATE INDEX `ledger_units_user_imei_idx` ON `ledger_units` (`userId`,`imei`);--> statement-breakpoint
CREATE INDEX `ledger_units_state_idx` ON `ledger_units` (`userId`,`currentState`);--> statement-breakpoint
CREATE INDEX `signal_queue_user_status_idx` ON `signal_queue` (`userId`,`status`,`score`);--> statement-breakpoint
CREATE INDEX `sync_sources_user_idx` ON `sync_sources` (`userId`,`provider`,`status`);