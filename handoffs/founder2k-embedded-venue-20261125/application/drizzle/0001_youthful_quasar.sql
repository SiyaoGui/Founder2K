CREATE TABLE `platform_items` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`owner` text NOT NULL,
	`parent` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `platform_owner` ON `platform_items` (`owner`,`kind`);--> statement-breakpoint
CREATE INDEX `platform_parent` ON `platform_items` (`parent`,`kind`,`status`);--> statement-breakpoint
CREATE TABLE `platform_votes` (
	`ballot` text NOT NULL,
	`voter` text NOT NULL,
	`choice` text NOT NULL,
	PRIMARY KEY(`ballot`, `voter`),
	FOREIGN KEY (`ballot`) REFERENCES `platform_items`(`id`) ON UPDATE no action ON DELETE no action
);
