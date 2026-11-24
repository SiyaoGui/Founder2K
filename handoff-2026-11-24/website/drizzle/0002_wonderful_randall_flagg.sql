CREATE TABLE `her_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`author` text NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`state` text NOT NULL,
	`data` text NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `her_author` ON `her_entries` (`author`,`kind`);--> statement-breakpoint
CREATE INDEX `her_target` ON `her_entries` (`target`,`kind`);--> statement-breakpoint
CREATE INDEX `her_catalog` ON `her_entries` (`kind`,`state`,`updated`);