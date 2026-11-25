// Move this synthetic event's first cutoff close to the present and exercise the actual clock worker.
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const [mode, sqlFile, manifest] = process.argv.slice(2),
  { id, members, meetings } = JSON.parse(readFileSync(manifest));
if (mode === "seed") {
  const session = JSON.parse(
    readFileSync(sqlFile, "utf8")
      .split("'private','")[1]
      .split("',")[0]
      .replaceAll("''", "'"),
  );
  session.start = new Date(Date.now() - 25 * 60000 + 25000).toISOString();
  writeFileSync(
    sqlFile,
    "UPDATE her_entries SET data='" +
      JSON.stringify(session).replaceAll("'", "''") +
      "' WHERE kind='women-program' AND id='" +
      id +
      "';",
  );
  process.exit();
}
const m = meetings.find((m) => m.round === 1),
  a = members.find((p) => p.id === m.lead),
  b = members.find((p) => p.id === m.partner);
const h = { account: "host", name: "host@venue.test" },
  devices = new Map(),
  base = "http://127.0.0.1:8790";
async function call(user, action, data = {}) {
  if (!devices.has(user.account)) devices.set(user.account, randomUUID());
  const res = await fetch(base + "/api/venue", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: base,
      "oai-authenticated-user-id": user.account,
      "oai-authenticated-user-email":
        user === h ? h.name : user.account + "@venue.test",
    },
    body: JSON.stringify({
      id,
      action,
      device: devices.get(user.account),
      ...data,
    }),
  });
  const d = await res.json();
  assert.equal(res.status, 200, action + " " + JSON.stringify(d.error));
  return d;
}
for (const u of [h, a, b]) await call(u, "check", { text: u.name });
await call(h, "handoff", {
  groups: [a.id],
  revision: (await call(h, "view")).revision,
});
await call(h, "view");
await call(a, "admit", { round: 1 });
await call(b, "admit", { round: 1 });
const v = await call(a, "view"),
  cutoff = v.agenda[0].end;
assert.ok(v.active && cutoff > Date.now());
await new Promise((r) => setTimeout(r, cutoff - Date.now() + 2000));
// Maintenance runs without browser polling during the wait.
const after = await call(a, "view");
assert.ok(after.agenda[0].closed >= cutoff);
assert.equal(after.active, null);
assert.equal(after.agenda[0].actual, null);
console.log(
  "PASS server cutoff released room",
  after.agenda[0].closed - cutoff,
  "ms after deadline; no fabricated connection time",
);
