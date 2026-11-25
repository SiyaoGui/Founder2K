import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

const migration = readFileSync(new URL('../drizzle/0003_venue_execution.sql', import.meta.url), 'utf8');

test('competing dispatches cannot take either account or the room before media closure', t => {
  const dir = mkdtempSync(join(tmpdir(), 'venue-test-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  const path = join(dir, 'rehearsal.db');
  const primary = new DatabaseSync(path);
  const second = new DatabaseSync(path);
  t.after(() => { primary.close(); second.close(); });
  primary.exec('PRAGMA foreign_keys=ON');
  second.exec('PRAGMA foreign_keys=ON');
  primary.exec(migration);
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
