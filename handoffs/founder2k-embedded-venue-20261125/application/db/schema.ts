import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
export const records=sqliteTable('records',{id:text('id').primaryKey(),owner:text('owner').notNull(),kind:text('kind').notNull(),payload:text('payload').notNull(),updated:integer('updated').notNull()});

export const herEntries = sqliteTable('her_entries', {
  id:text('id').primaryKey(), kind:text('kind').notNull(), author:text('author').notNull(),
  target:text('target').notNull().default(''), state:text('state').notNull(),
  data:text('data').notNull(), updated:integer('updated').notNull(),
}, table=>[index('her_author').on(table.author,table.kind),index('her_target').on(table.target,table.kind),index('her_catalog').on(table.kind,table.state,table.updated)]);

export const platformItems = sqliteTable('platform_items', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  owner: text('owner').notNull(),
  parent: text('parent').notNull().default(''),
  status: text('status').notNull(),
  payload: text('payload').notNull(),
  created: integer('created').notNull(),
  updated: integer('updated').notNull(),
}, table => [index('platform_owner').on(table.owner, table.kind), index('platform_parent').on(table.parent, table.kind, table.status)]);

export const platformVotes = sqliteTable('platform_votes', {
  ballot: text('ballot').notNull().references(() => platformItems.id),
  voter: text('voter').notNull(),
  choice: text('choice').notNull(),
}, table => [primaryKey({ columns: [table.ballot, table.voter] })]);

export * from './venue-schema';
