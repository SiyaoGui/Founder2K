import { sql } from 'drizzle-orm';
import { check, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

// The authenticated event API resolves these identifiers from the published schedule.
export const venueMeetings = sqliteTable('venue_meetings', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull(),
  appointmentId: text('appointment_id').notNull(),
  logicalRoom: text('logical_room').notNull(),
  hostAccount: text('host_account').notNull(),
  visitorAccount: text('visitor_account').notNull(),
  plannedStartMs: integer('planned_start_ms').notNull(),
  plannedEndMs: integer('planned_end_ms').notNull(),
  mediaConnectedMs: integer('media_connected_ms'),
  mediaClosedMs: integer('media_closed_ms'),
}, t => [
  unique().on(t.eventId, t.appointmentId),
  check('venue_distinct_accounts', sql`${t.hostAccount} <> ${t.visitorAccount}`),
  check('venue_planned_interval', sql`${t.plannedEndMs} > ${t.plannedStartMs}`),
  check('venue_media_interval', sql`${t.mediaConnectedMs} IS NULL OR ${t.mediaClosedMs} IS NULL OR ${t.mediaClosedMs} >= ${t.mediaConnectedMs}`),
]);

export const venueAdmissions = sqliteTable('venue_admissions', {
  meetingId: text('meeting_id').primaryKey().references(() => venueMeetings.id),
  mediaGeneration: text('media_generation').notNull().unique(),
});

export const venueRoomOccupancy = sqliteTable('venue_room_occupancy', {
  eventId: text('event_id').notNull(),
  logicalRoom: text('logical_room').notNull(),
  meetingId: text('meeting_id').notNull().unique().references(() => venueAdmissions.meetingId, { onDelete: 'cascade' }),
}, t => [primaryKey({ columns: [t.eventId, t.logicalRoom] })]);

export const venueAccountOccupancy = sqliteTable('venue_account_occupancy', {
  accountId: text('account_id').primaryKey(),
  meetingId: text('meeting_id').notNull().references(() => venueAdmissions.meetingId, { onDelete: 'cascade' }),
});
