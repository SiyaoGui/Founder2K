// Optional local 20-room audio check. Uses the same app grants as the participant UI.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { distribute, ideaRoom } from "../../app/venue/grouping.ts";
const [mode, sql, manifest] = process.argv.slice(2);
const base = "http://127.0.0.1:8790",
  count = 20;
if (mode === "seed") {
  const id = randomUUID(),
    members = Array.from({ length: 100 }, (_, i) => ({
      id: randomUUID(),
      name: "成员" + (i + 1),
      account: "many-" + i,
      group: "lobby",
      skills: "",
      tag: i < count ? "idea" : i < 60 ? "builder" : "seller",
    }));
  const rows = [
    [
      id,
      "cohort",
      "host",
      "",
      "open",
      {
        title: "并行分组彩排",
        venueFormat: "创业快闪",
        start: new Date().toISOString(),
      },
    ],
    ...members.map((m) => [
      m.id,
      "application",
      m.account,
      id,
      "admitted",
      { role: "参与者", name: m.name },
    ]),
  ];
  writeFileSync(
    sql,
    rows
      .map(
        ([id, kind, owner, parent, state, data]) =>
          "INSERT INTO platform_items VALUES(" +
          [
            id,
            kind,
            owner,
            parent,
            state,
            JSON.stringify(data),
            Date.now(),
            Date.now(),
          ]
            .map((v) => "'" + String(v).replaceAll("'", "''") + "'")
            .join(",") +
          ");",
      )
      .join("\n"),
  );
  writeFileSync(manifest, JSON.stringify({ id, members }));
  process.exit();
}
const { id, members } = JSON.parse(readFileSync(manifest));
const host = { account: "host", name: "host@venue.test" };
const devices = new Map();
async function call(u, action, data = {}) {
  if (!devices.has(u.account)) devices.set(u.account, randomUUID());
  const res = await fetch(base + "/api/venue", {
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
  const v = await res.json();
  assert.equal(res.status, 200, action + " " + (v.error || ""));
  return v;
}
const roster = distribute(
  members,
  new Set(members.map((m) => m.id)),
  "balanced",
);
await call(host, "check", { text: host.name });
await call(host, "teamPlan", {
  revision: (await call(host, "view")).revision,
  plan: roster.map(({ id, tag, group }) => ({ id, tag, group })),
});
const snapshot = await call(host, "view");
const pairs = members.slice(0, count).map((sender) => {
  const group = snapshot.teamRoster.filter(
    (m) => m.group === ideaRoom(sender.id),
  );
  assert.deepEqual(
    ["idea", "builder", "seller"].map(
      (t) => group.filter((m) => m.tag === t).length,
    ),
    [1, 2, 2],
  );
  return [
    sender,
    members.find((m) => m.id === group.find((p) => p.tag === "builder").id),
  ];
});
for (const pair of pairs)
  await Promise.all(pair.map((u) => call(u, "check", { text: u.name })));
await call(host, "handoff", {
  revision: snapshot.revision,
  groups: pairs.map(([u]) => ideaRoom(u.id)),
});
await call(host, "view");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
try {
  const page = await browser.newPage();
  await page.goto(base + "/venue");
  await page.addScriptTag({
    path: "node_modules/livekit-client/dist/livekit-client.umd.js",
  });
  await page.evaluate(() => {
    window.lab = {
      audio: new AudioContext(),
      meters: [],
      rooms: [],
      sources: [],
    };
  });
  for (let i = 0; i < pairs.length; i++) {
    const tickets = await Promise.all(pairs[i].map((u) => call(u, "media")));
    assert.equal(tickets[0].room, tickets[1].room);
    await page.evaluate(
      async ({ tickets, hz }) => {
        const { audio, rooms, meters, sources } = window.lab;
        await audio.resume();
        const [sender, receiver] = [
          new LivekitClient.Room(),
          new LivekitClient.Room(),
        ];
        rooms.push(sender, receiver);
        const meter = { peers: receiver, hz, tracks: [] };
        meters.push(meter);
        receiver.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
          const playback = track.attach();
          document.body.appendChild(playback);
          void playback.play();
          const a = audio.createAnalyser();
          a.fftSize = 4096;
          const source = audio.createMediaStreamSource(
            new MediaStream([track.mediaStreamTrack]),
          );
          source.connect(a);
          sources.push(source);
          meter.tracks.push(a);
        });
        await Promise.all([
          sender.connect(tickets[0].url, tickets[0].token),
          receiver.connect(tickets[1].url, tickets[1].token),
        ]);
        const o = audio.createOscillator(),
          out = audio.createMediaStreamDestination();
        o.frequency.value = hz;
        o.connect(out);
        o.start();
        sources.push(o, out);
        await sender.localParticipant.publishTrack(
          out.stream.getAudioTracks()[0],
          { source: LivekitClient.Track.Source.Microphone },
        );
      },
      { tickets, hz: 360 + i * 80 },
    );
  }
  await page
    .waitForFunction(
      () =>
        window.lab.meters.every(({ peers, hz, tracks }) => {
          if (peers.remoteParticipants.size !== 1 || tracks.length !== 1)
            return false;
          const a = tracks[0],
            buf = new Float32Array(a.frequencyBinCount);
          a.getFloatFrequencyData(buf);
          const peak = Math.max(...buf);
          return (
            Number.isFinite(peak) &&
            Math.abs(
              (buf.indexOf(peak) * window.lab.audio.sampleRate) / a.fftSize -
                hz,
            ) < 32
          );
        }),
      null,
      { timeout: 60000 },
    )
    .catch(async (error) => {
      const observations = await page.evaluate(() =>
        window.lab.meters.map(({ peers, hz, tracks }) => {
          const a = tracks[0];
          const buf = new Float32Array(a?.frequencyBinCount || 1);
          a?.getFloatFrequencyData(buf);
          const max = Math.max(...buf);
          return {
            expected: hz,
            peers: peers.remoteParticipants.size,
            tracks: tracks.length,
            received:
              a && Number.isFinite(max)
                ? Math.round(
                    (buf.indexOf(max) * window.lab.audio.sampleRate) /
                      a.fftSize,
                  )
                : null,
          };
        }),
      );
      console.error("Receiver measurements", JSON.stringify(observations));
      throw error;
    });
  console.log(
    "PASS 100 assigned across 20 teams with one idea, two builders and two sellers each; 40 concurrent WebRTC participant connections, 20 independent received audio frequencies",
  );
} finally {
  await browser.close();
}
