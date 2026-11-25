-- Account and event references are resolved by the existing authenticated event API.
-- One row represents one execution of an appointment in a published schedule.
CREATE TABLE venue_meetings (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  logical_room TEXT NOT NULL,
  host_account TEXT NOT NULL,
  visitor_account TEXT NOT NULL,
  planned_start_ms INTEGER NOT NULL,
  planned_end_ms INTEGER NOT NULL,
  media_connected_ms INTEGER,
  media_closed_ms INTEGER,
  CHECK (host_account <> visitor_account),
  CHECK (planned_end_ms > planned_start_ms),
  CHECK (media_connected_ms IS NULL OR media_closed_ms IS NULL OR media_closed_ms >= media_connected_ms),
  UNIQUE (event_id, appointment_id)
);

-- An admission occupies the room and both accounts in a single INSERT.
-- Keep the admission during disconnects and revocation. Close only after the
-- authenticated media adapter confirms the old media session has been fenced.
CREATE TABLE venue_admissions (
  meeting_id TEXT PRIMARY KEY NOT NULL REFERENCES venue_meetings(id),
  media_generation TEXT NOT NULL UNIQUE
);
CREATE TABLE venue_room_occupancy (
  event_id TEXT NOT NULL,
  logical_room TEXT NOT NULL,
  meeting_id TEXT NOT NULL UNIQUE REFERENCES venue_admissions(meeting_id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, logical_room)
);
CREATE TABLE venue_account_occupancy (
  account_id TEXT PRIMARY KEY NOT NULL,
  meeting_id TEXT NOT NULL REFERENCES venue_admissions(meeting_id) ON DELETE CASCADE
);
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
CREATE TRIGGER venue_release AFTER UPDATE OF media_closed_ms ON venue_meetings
WHEN OLD.media_closed_ms IS NULL AND NEW.media_closed_ms IS NOT NULL
BEGIN
  DELETE FROM venue_admissions WHERE meeting_id = NEW.id;
END;
