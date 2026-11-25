import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const { id, members, meetings } = JSON.parse(readFileSync(process.argv[2]));
const host = { account: "host", name: "host@venue.test" },
  operator = members.find((m) => m.role === "共创伙伴"),
  devices = new Map();
const base = "http://127.0.0.1:8790";
async function call(u, action, data = {}) {
  if (!devices.has(u.account)) devices.set(u.account, randomUUID());
  const response = await fetch(base + "/api/venue", {
    method: "POST",
    headers: {
      origin: base,
      "content-type": "application/json",
      "oai-authenticated-user-id": u.account,
      "oai-authenticated-user-email":
        u === host ? u.name : u.account + "@venue.test",
    },
    body: JSON.stringify({
      id,
      action,
      device: devices.get(u.account),
      ...data,
    }),
  });
  return { code: response.status, body: await response.json() };
}
async function ok(u, action, data) {
  const r = await call(u, action, data);
  assert.equal(r.code, 200, JSON.stringify(r.body));
  return r.body;
}
for (const user of [host, operator])
  await ok(user, "check", { text: user.name });
const rev = async () => (await ok(host, "view")).revision;
await ok(host, "dispatchRole", {
  revision: await rev(),
  text: operator.id,
  automatic: true,
});
const appointment = meetings.find((m) => m.round === 5),
  data = { group: appointment.lead, round: 5, revision: await rev() };
const race = await Promise.all([
  call(operator, "shift", { ...data, delay: 30 }),
  call(host, "shift", { ...data, delay: 60 }),
]);
assert.deepEqual(race.map((x) => x.code).sort(), [200, 409]);
assert.equal(
  (await call(operator, "recall", { revision: await rev() })).code,
  403,
);
await ok(host, "dispatchRole", {
  revision: await rev(),
  text: operator.id,
  automatic: false,
});
assert.equal(
  (await call(operator, "shift", { ...data, revision: await rev(), delay: 20 }))
    .code,
  403,
);
console.log(
  "PASS two separately signed-in operators compete for one appointment; delegated role cannot recall the event and is revocable",
);
// A browser-created rehearsal reuses event authorization, with a fresh execution namespace.
const before = await ok(host, "view");
const created = await ok(host, "rehearse");
assert.ok(created.rehearsalId && created.rehearsalId !== id);
const rehearsal = { id: created.rehearsalId };
assert.equal((await call(operator, "rehearse")).code, 403);
const local = await ok(operator, "view", rehearsal);
assert.equal(local.rehearsalOf, id);
assert.equal(local.checked, false);
assert.equal(local.agenda.length, 6);
assert.deepEqual(
  local.agenda.map((s) => s.name),
  (await ok(operator, "view")).agenda.map((s) => s.name),
);
await ok(host, "check", { ...rehearsal, text: host.name });
const runRev = (await ok(host, "view", rehearsal)).revision;
await ok(host, "notify", { ...rehearsal, revision: runRev, text: "彩排通知" });
assert.equal((await ok(operator, "view", rehearsal)).notice, "彩排通知");
assert.equal((await ok(host, "view")).notice, before.notice);
assert.equal(
  (await call({ account: "not-registered", name: "test" }, "view", rehearsal))
    .code,
  403,
);
console.log(
  "PASS host-created private rehearsal, original enrollment and schedule, separate check-in and notifications",
);
