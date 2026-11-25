// Run beside the isolated Worker started by run.mjs. The SQL input contains only synthetic events.
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const [mode, file, manifest] = process.argv.slice(2),
  base = "http://127.0.0.1:8790";
if (mode === "seed") {
  const q = (v) => "'" + String(v).replaceAll("'", "''") + "'",
    sql = [],
    defs = [];
  const item = (id, kind, owner, parent, status, payload) =>
    sql.push(
      "INSERT INTO platform_items VALUES(" +
        [
          id,
          kind,
          owner,
          parent,
          status,
          JSON.stringify(payload),
          Date.now(),
          Date.now(),
        ]
          .map(q)
          .join(",") +
        ");",
    );
  for (const format of ["创业快闪", "导师答疑", "路演"]) {
    const id = randomUUID(),
      team = randomUUID(),
      people = Array.from({ length: 3 }, (_, i) => ({
        id: randomUUID(),
        account: "mode-test-" + i,
        name: ["林", "林", "Ari"][i],
        role: i === 2 ? "旁听" : "参与者",
      }));
    item(id, "cohort", "host", "", "open", {
      title: format + "彩排",
      venueFormat: format,
      start: new Date(Date.now() - 4 * 3600000).toISOString(),
    });
    for (const p of people)
      item(p.id, "application", p.account, id, "admitted", {
        name: p.name,
        role: p.role,
        goal: "原型验证",
      });
    if (format === "创业快闪")
      item(team, "team", people[0].account, id, "active", {
        title: "彩排小组",
      });
    defs.push({ id, team, format, people });
  }
  writeFileSync(file, sql.join("\n"));
  writeFileSync(manifest, JSON.stringify(defs));
  process.exit();
}
const defs = JSON.parse(readFileSync(manifest));
for (const {
  id,
  team,
  format,
  people: [p, q, audience],
} of defs) {
  const devices = new Map(),
    host = { account: "host", name: "host@venue.test" };
  async function call(user, action, data = {}, code = 200) {
    if (!devices.has(user.account)) devices.set(user.account, randomUUID());
    const r = await fetch(base + "/api/venue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: base,
        "oai-authenticated-user-id": user.account,
        "oai-authenticated-user-email":
          user === host ? host.name : user.account + "@venue.test",
      },
      body: JSON.stringify({
        id,
        action,
        device: devices.get(user.account),
        ...data,
      }),
    });
    const v = await r.json();
    assert.equal(
      r.status,
      code,
      format + " " + action + " " + JSON.stringify(v.error),
    );
    return v;
  }
  const revision = async () => (await call(host, "view")).revision;
  for (const u of [host, p, q, audience])
    await call(u, "check", { text: u.name });
  if (format === "创业快闪") {
    await call(host, "handoff", { groups: [team], revision: await revision() });
    await call(host, "view");
    assert.ok((await call(p, "media")).publish);
    await call(q, "visit", { group: team, revision: await revision() });
    const before = await call(p, "view");
    assert.equal(before.visits[0].approved, false);
    await call(p, "acceptVisit", {
      group: team,
      text: q.id,
      revision: await revision(),
    });
    const after = await call(q, "view");
    assert.equal(after.group, team);
    await call(
      audience,
      "visit",
      { group: team, revision: await revision() },
      403,
    );
  } else if (format === "导师答疑") {
    await call(host, "book", {
      group: p.id,
      partner: q.id,
      round: 1,
      revision: await revision(),
    });
    assert.ok((await call(q, "view")).agenda[0].name.startsWith(p.name));
    await call(
      host,
      "book",
      { group: p.id, partner: q.id, round: 1, revision: await revision() },
      409,
    );
    assert.equal((await call(audience, "view")).agenda.length, 0);
  } else {
    await call(host, "lineup", { text: p.id, revision: await revision() });
    assert.equal((await call(p, "view")).queueAhead, 0);
    await call(host, "call", { text: p.id, revision: await revision() });
    assert.ok((await call(p, "media")).publish);
    assert.equal((await call(audience, "media")).publish, false);
    // The event started four hours ago. A fresh authenticated request must still return a new grant.
    const firstToken = (await call(audience, "media")).token;
    const expiry = JSON.parse(
      Buffer.from(firstToken.split(".")[1], "base64url"),
    ).exp;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, expiry * 1000 - Date.now() + 1000)),
    );
    const later = await call(audience, "media");
    assert.ok(
      JSON.parse(Buffer.from(later.token.split(".")[1], "base64url")).exp >
        expiry,
    );
    assert.equal(later.publish, false);
    console.log("PASS expired short grant renewed, four-hour-old event");
  }
  console.log("PASS activity mode " + format);
}
