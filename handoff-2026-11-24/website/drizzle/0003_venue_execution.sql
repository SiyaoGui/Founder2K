CREATE TABLE `venue_account_occupancy` (
	`account_id` text PRIMARY KEY NOT NULL,
	`meeting_id` text NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `venue_admissions`(`meeting_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `venue_admissions` (
	`meeting_id` text PRIMARY KEY NOT NULL,
	`media_generation` text NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `venue_meetings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venue_admissions_media_generation_unique` ON `venue_admissions` (`media_generation`);--> statement-breakpoint
CREATE TABLE `venue_meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`appointment_id` text NOT NULL,
	`logical_room` text NOT NULL,
	`host_account` text NOT NULL,
	`visitor_account` text NOT NULL,
	`planned_start_ms` integer NOT NULL,
	`planned_end_ms` integer NOT NULL,
	`media_connected_ms` integer,
	`media_closed_ms` integer,
	CONSTRAINT "venue_distinct_accounts" CHECK("venue_meetings"."host_account" <> "venue_meetings"."visitor_account"),
	CONSTRAINT "venue_planned_interval" CHECK("venue_meetings"."planned_end_ms" > "venue_meetings"."planned_start_ms"),
	CONSTRAINT "venue_media_interval" CHECK("venue_meetings"."media_connected_ms" IS NULL OR "venue_meetings"."media_closed_ms" IS NULL OR "venue_meetings"."media_closed_ms" >= "venue_meetings"."media_connected_ms")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venue_meetings_event_id_appointment_id_unique` ON `venue_meetings` (`event_id`,`appointment_id`);--> statement-breakpoint
CREATE TABLE `venue_room_occupancy` (
	`event_id` text NOT NULL,
	`logical_room` text NOT NULL,
	`meeting_id` text NOT NULL,
	PRIMARY KEY(`event_id`, `logical_room`),
	FOREIGN KEY (`meeting_id`) REFERENCES `venue_admissions`(`meeting_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venue_room_occupancy_meeting_id_unique` ON `venue_room_occupancy` (`meeting_id`);
--> statement-breakpoint
CREATE TRIGGER venue_reserve AFTER INSERT ON venue_admissions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM venue_meetings WHERE id = NEW.meeting_id AND media_closed_ms IS NULL
  ) THEN RAISE(ABORT, 'meeting unavailable') END;
  INSERT INTO venue_room_occupancy
    SELECT event_id, logical_room, id FROM venue_meetings WHERE id = NEW.meeting_id;
  INSERT INTO venue_account_occupancy
    SELECT host_account, id FROM venue_meetings WHERE id = NEW.meeting_id
    UNION ALL SELECT visitor_account, id FROM venue_meetings WHERE id = NEW.meeting_id;
END;
--> statement-breakpoint
CREATE TRIGGER venue_release AFTER UPDATE OF media_closed_ms ON venue_meetings
WHEN OLD.media_closed_ms IS NULL AND NEW.media_closed_ms IS NOT NULL
BEGIN
  DELETE FROM venue_admissions WHERE meeting_id = NEW.id;
END;
