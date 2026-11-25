// All requests are restricted to the synthetic event in the loopback D1 instance.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const { id, members, meetings } = JSON.parse(readFileSync(process.argv[2]));
const base = "http://127.0.0.1:8790",
  devices = new Map();
const host = { name: "host@venue.test", account: "host", id: "host" };
function member(id) {
  return members.find((m) => m.id === id);
}
async function send(user, path, body) {
  const url = new URL(path, base);
  assert.equal(url.origin, base);
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      origin: base,
      "oai-authenticated-user-id": user.account,
      "oai-authenticated-user-email":
        user === host ? host.name : user.account + "@venue.test",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { code: res.status, data: await res.json() };
}
function call(user, action, data = {}) {
  if (!devices.has(user.id)) devices.set(user.id, randomUUID());
  return send(user, "/api/venue", {
    id,
    action,
    device: devices.get(user.id),
    ...data,
  });
}
async function ok(user, action, data) {
  const r = await call(user, action, data);
  assert.equal(r.code, 200, action + " " + JSON.stringify(r.data));
  return r.data;
}
async function program(user, action, data) {
  const { data: s } = await send(user, "/api/women-program?id=" + id);
  const r = await send(user, "/api/women-program", {
    id,
    revision: s.revision,
    action,
    data,
  });
  assert.equal(r.code, 200, JSON.stringify(r.data));
}
const a = meetings.find((m) => m.round === 1),
  next = meetings.find((m) => m.lead === a.lead && m.round === 2),
  other = meetings.find((m) => m.round === 1 && m.partner === next.partner);
const lead = member(a.lead),
  visitor = member(a.partner),
  leadB = member(other.lead),
  visitorB = member(other.partner);
for (const u of [host, lead, visitor, leadB, visitorB])
  await ok(u, "check", { text: u.name });
const before = await ok(visitorB, "view");
const rev = (await ok(host, "view")).revision;
await ok(host, "handoff", { groups: [lead.id, leadB.id], revision: rev });
await ok(host, "view");
await ok(lead, "admit", { round: 1 });
await ok(visitor, "admit", { round: 1 });
await ok(leadB, "admit", { round: 1 });
await ok(visitorB, "admit", { round: 1 });
await ok(lead, "end");
assert.equal((await ok(lead, "view")).agenda[1].status, "仍在上一场");
await ok(lead, "ready", { round: 2 });
assert.equal((await call(visitorB, "ready", { round: 2 })).code, 409);
assert.equal((await call(lead, "admit", { round: 2 })).code, 409);
assert.equal(
  (await ok(visitorB, "view")).active,
  [id, 1, other.lead, other.partner].join("."),
);
await ok(visitorB, "end");
await ok(visitorB, "ready", { round: 2 });
await ok(lead, "admit", { round: 2 });
const after = await ok(visitorB, "view");
assert.deepEqual(
  before.agenda.map((s) => s.planned),
  after.agenda.map((s) => s.planned),
);
console.log(
  "PASS early finish, occupied next partner, mutual early admission, six fixed planned times",
);
const old = devices.get(visitorB.id);
devices.set(visitorB.id, randomUUID());
await ok(visitorB, "check", { text: visitorB.name });
assert.equal((await call(visitorB, "pulse", { device: old })).code, 409);
assert.equal((await ok(visitorB, "view")).active, null);
await ok(visitorB, "leave");
assert.equal((await call(visitorB, "media")).code, 409);
const unrelated = { account: "rehearsal-outsider", id: "unregistered" };
assert.equal((await call(unrelated, "view")).code, 403);
console.log("PASS device replacement, leave, non-member access");
const current = (await ok(host, "view")).revision;
const edits = await Promise.all([
  call(host, "shift", {
    round: 4,
    group: lead.id,
    delay: 30,
    revision: current,
  }),
  call(host, "shift", {
    round: 4,
    group: lead.id,
    delay: 60,
    revision: current,
  }),
]);
assert.deepEqual(edits.map((r) => r.code).sort(), [200, 409]);
const fourth = meetings.find((m) => m.lead === lead.id && m.round === 4);
const left = (await ok(lead, "view")).agenda[3],
  right = (await ok(member(fourth.partner), "view")).agenda[3];
assert.equal(left.start, right.start);
assert.ok(left.start > left.planned);
console.log(
  "PASS concurrent reschedule, same updated appointment at both endpoints",
);
await program(lead, "invite", { partner: visitor.id, talked: true });
await program(visitor, "respond", { lead: lead.id, accept: true });
await program(lead, "submit", {});
await program(host, "review", {
  lead: lead.id,
  approve: true,
  reason: "独立彩排身份已双方确认",
});
const { data: result } = await send(visitor, "/api/women-program?id=" + id);
assert.ok(result.teams[lead.id]);
const { data: platform } = await send(visitor, "/api/platform");
assert.ok(platform.teams.some((x) => x.id === result.teams[lead.id]));
console.log(
  "PASS accepted invitation, review and access through the existing team workspace",
);
const absent = members.find(
  (m) =>
    m.role === "项目发起人" &&
    m.id !== lead.id &&
    meetings.some((x) => x.lead === m.id && x.partner === visitor.id),
);
const affected = meetings.find(
  (x) => x.lead === absent.id && x.partner === visitor.id,
);
await program(absent, "withdraw", {});
const gap = await ok(visitor, "view");
assert.equal(gap.agenda.length, 6);
assert.equal(gap.agenda[affected.round - 1].empty, true);
assert.ok(gap.agenda[0].closed);
console.log(
  "PASS a withdrawn appointment becomes an empty slot while completed history stays visible",
);
