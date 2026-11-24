import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

const migrationsDir = new URL('../drizzle/', import.meta.url);
const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', migrationsDir), 'utf8'));

function migrate(db, tag) {
  const sql = readFileSync(new URL(tag + '.sql', migrationsDir), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    if (statement.trim()) db.prepare(statement).run();
  }
}

function upgrade(db) {
  for (const { tag } of journal.entries) {
    migrate(db, tag);
    if (tag === '0003_venue_execution') break;
  }
}

test('upgrade from 0002 preserves the four existing tables and their rows', t => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  assert.deepEqual(journal.entries.slice(0, 4).map(entry => entry.tag), [
    '0000_quick_miek', '0001_youthful_quasar', '0002_wonderful_randall_flagg', '0003_venue_execution',
  ]);
  for (const entry of journal.entries.slice(0, 3)) migrate(db, entry.tag);
  db.exec(`
    INSERT INTO records VALUES ('r', 'member', 'draft', '{}', 1);
    INSERT INTO platform_items VALUES ('i', 'ballot', 'member', '', 'open', '{}', 1, 2);
    INSERT INTO platform_votes VALUES ('i', 'member', 'yes');
    INSERT INTO her_entries VALUES ('h', 'activity', 'member', '', 'published', '{}', 1);
  `);
  const tables = ['records', 'platform_items', 'platform_votes', 'her_entries'];
  const readRows = () => tables.map(name => db.prepare('SELECT * FROM ' + name).all());
  const before = readRows();
  migrate(db, '0003_venue_execution');
  assert.deepEqual(readRows(), before);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('competing dispatches cannot take either account or the room before media closure', t => {
  const dir = mkdtempSync(join(tmpdir(), 'venue-test-'));
  const path = join(dir, 'rehearsal.db');
  const primary = new DatabaseSync(path);
  const second = new DatabaseSync(path);
  t.after(() => { primary.close(); second.close(); rmSync(dir, {recursive: true, force: true}); });
  primary.exec('PRAGMA foreign_keys=ON');
  second.exec('PRAGMA foreign_keys=ON');
  upgrade(primary);
  const schedule = primary.prepare('INSERT INTO venue_meetings VALUES (?, ?, ?, ?, ?, ?, 1000, 2000, NULL, NULL)');
  schedule.run('first', 'event1', 'appointment1', 'room1', 'host1', 'visitor1');
  schedule.run('next', 'event1', 'appointment2', 'room1', 'host2', 'visitor2');
  schedule.run('elsewhere', 'event2', 'appointment3', 'room2', 'visitor1', 'visitor3');
  const hold = 'INSERT INTO venue_admissions VALUES (?, ?)';
  primary.exec('BEGIN IMMEDIATE');
  primary.prepare(hold).run('first', 'media1');
  second.exec('PRAGMA busy_timeout=0');
  assert.throws(() => second.prepare(hold).run('elsewhere', 'media2'), /locked/);
  primary.exec('COMMIT');
  assert.throws(() => second.prepare(hold).run('elsewhere', 'media2'), /UNIQUE/);
  assert.throws(() => second.prepare(hold).run('next', 'media3'), /UNIQUE/);
  assert.equal(second.prepare('SELECT count(*) AS n FROM venue_room_occupancy').get().n, 1);
  assert.equal(second.prepare('SELECT count(*) AS n FROM venue_account_occupancy').get().n, 2);
  primary.prepare('UPDATE venue_meetings SET media_closed_ms=1600 WHERE id=?').run('first');
  second.prepare(hold).run('next', 'media3');
  assert.throws(() => primary.prepare(hold).run('first', 'stale'), /unavailable/);
  assert.equal(second.prepare('SELECT planned_start_ms FROM venue_meetings WHERE id=?').get('next').planned_start_ms, 1000);
});
