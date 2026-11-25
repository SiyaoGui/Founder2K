// Run only in run.mjs's isolated loopback rehearsal.
const { chromium } = require("playwright-core");
const { randomUUID } = require("node:crypto");
const { readFileSync, writeFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const [mode, sql, manifest] = process.argv.slice(2);
const base = "http://127.0.0.1:8790";
if (mode === "seed") {
  const id = randomUUID(),
    names = ["林悦", "周岚", "Bo", "Ada", "Chen", "Fay", "Gil", "Hao"];
  const tags = [
    "idea",
    "idea",
    "builder",
    "builder",
    "builder",
    "seller",
    "seller",
    "unset",
  ];
  const people = names.map((name, i) => ({
    name,
    id: randomUUID(),
    account: "board-" + i,
    tag: tags[i],
  }));
  const items = [];
  function add(key, kind, owner, parent, status, data) {
    const values = [
      key,
      kind,
      owner,
      parent,
      status,
      JSON.stringify(data),
      Date.now(),
      Date.now(),
    ];
    items.push(
      "INSERT INTO platform_items VALUES(" +
        values
          .map((x) => "'" + String(x).replaceAll("'", "''") + "'")
          .join(",") +
        ");",
    );
  }
  add(id, "cohort", "host", "", "open", {
    title: "创业快闪 · 创意组队",
    venueFormat: "创业快闪",
    start: new Date().toISOString(),
  });
  for (const p of people)
    add(p.id, "application", p.account, id, "admitted", {
      name: p.name,
      role: "参与者",
      goal: "快闪共创",
      skills: "产品与市场",
    });
  writeFileSync(sql, items.join("\n"));
  writeFileSync(manifest, JSON.stringify({ id, people }));
  process.exit();
}
const { id, people } = JSON.parse(readFileSync(manifest));
const host = { account: "host", name: "host@venue.test" },
  devices = new Map();
const headers = (u) => ({
  "content-type": "application/json",
  origin: base,
  "oai-authenticated-user-id": u.account,
  "oai-authenticated-user-email":
    u === host ? u.name : u.account + "@venue.test",
});
async function api(u, action, data = {}, code = 200) {
  if (!devices.has(u.account)) devices.set(u.account, randomUUID());
  const r = await fetch(base + "/api/venue", {
    method: "POST",
    headers: headers(u),
    body: JSON.stringify({
      id,
      device: devices.get(u.account),
      action,
      ...data,
    }),
  });
  const v = await r.json();
  assert.equal(r.status, code, action + " " + (v.error || ""));
  return v;
}
async function run() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--autoplay-policy=no-user-gesture-required",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    await Promise.all(
      people.map((p) => api(p, "check", { text: p.name, teamTag: p.tag })),
    );
    async function open(u, width = 1280, tone = 440) {
      if (!devices.has(u.account)) devices.set(u.account, randomUUID());
      const ctx = await browser.newContext({
        viewport: { width, height: 950 },
        permissions: ["camera", "microphone"],
      });
      await ctx.route(base + "/**", (r) =>
        r.continue({ headers: { ...r.request().headers(), ...headers(u) } }),
      );
      await ctx.addInitScript(
        ({ device, tone }) => {
          sessionStorage.setItem("venue-device", device);
          const gum = navigator.mediaDevices.getUserMedia.bind(
            navigator.mediaDevices,
          );
          navigator.mediaDevices.getUserMedia = async (opts) => {
            if (!opts.audio) return gum(opts);
            const c = new AudioContext(),
              o = c.createOscillator(),
              d = c.createMediaStreamDestination();
            o.frequency.value = tone;
            o.connect(d);
            o.start();
            await c.resume();
            window.boardAudio = c;
            return d.stream;
          };
          navigator.mediaDevices.getDisplayMedia = async () => {
            const canvas = document.createElement("canvas");
            canvas.width = 320;
            canvas.height = 180;
            const g = canvas.getContext("2d");
            const draw = () => {
              g.fillStyle = "#174d33";
              g.fillRect(0, 0, 320, 180);
              g.fillStyle = "white";
              g.fillText("Founder2K main " + Date.now(), 12, 38);
            };
            draw();
            setInterval(draw, 200);
            return canvas.captureStream(5);
          };
        },
        { device: devices.get(u.account), tone },
      );
      const page = await ctx.newPage();
      await page.goto(base + "/venue?id=" + id);
      if (u === host) {
        await page.getByRole("textbox", { name: "确认报名姓名" }).fill(u.name);
        await page.getByRole("button", { name: "签到", exact: true }).click();
      }
      await page.getByRole("button", { name: "离开会场" }).waitFor();
      return page;
    }
    const page = await open(host),
      board = page.getByRole("region", { name: "快闪团队编组" });
    const click = (name) =>
      board.getByRole("button", { name, exact: true }).click();
    await click("全选有 idea");
    await click("分发所选 2 人");
    await click("全选Builder");
    await click("分发所选 3 人");
    await click("全选Seller");
    await board.getByLabel("分发方式").selectOption("alphabetical");
    await click("分发所选 2 人");
    const v = await api(host, "view");
    assert.ok(v.teamRoster.every((m) => m.group === "lobby"));
    await click("确认发布分组");
    await board
      .getByText("待发布", { exact: false })
      .waitFor({ state: "hidden" });
    const published = await api(host, "view");
    const teams = people
      .slice(0, 2)
      .map((p) =>
        published.teamRoster.filter((m) => m.group === "idea/" + p.id),
      );
    assert.ok(
      teams.every(
        (g) =>
          g.filter((m) => m.tag === "idea").length === 1 &&
          g.filter((m) => m.tag === "seller").length === 1,
      ),
    );
    assert.deepEqual(
      teams.map((g) => g.filter((m) => m.tag === "builder").length).sort(),
      [1, 2],
    );
    assert.equal((await api(people[2], "view")).teamRoster, undefined);
    const change = { id: people[2].id, tag: "builder", group: "lobby" };
    await api(
      people[2],
      "teamPlan",
      { revision: published.revision, plan: [change] },
      403,
    );
    await api(host, "teamPlan", { revision: v.revision, plan: [change] }, 409);
    if (process.env.VENUE_BOARD_SCREENSHOT)
      await board.screenshot({ path: process.env.VENUE_BOARD_SCREENSHOT });
    await page.getByRole("button", { name: "开始所有创意组讨论" }).click();
    await page.getByRole("button", { name: "确认操作" }).click();
    for (const p of people.slice(0, 2))
      assert.equal((await api(p, "view")).mode, "discussion");
    const main = people.at(-1);
    assert.equal((await api(main, "view")).mode, "stage");
    const [leadA, leadB] = await Promise.all([
      open(people[0], 1080, 660),
      open(people[1], 1080, 880),
    ]);
    const listeners = teams.map((g) =>
      people.find((p) => p.id === g.find((m) => m.tag === "seller").id),
    );
    const [listenA, listenB, onMain] = await Promise.all([
      open(listeners[0]),
      open(listeners[1], 390),
      open(main),
    ]);
    await page.getByRole("button", { name: "共享演示与主持人声音" }).click();
    await Promise.all(
      [leadA, leadB].map((p) =>
        p.getByRole("button", { name: "开启麦克风" }).click(),
      ),
    );
    async function hear(page, hz, video) {
      await page.waitForFunction(
        ({ hz, video }) => {
          const els = [...document.querySelectorAll(".venue-tracks audio")];
          const stream = els[0]?.srcObject,
            track = stream?.getAudioTracks()[0];
          if (!track || els.length !== 1) return false;
          const vid = document.querySelector(".venue-tracks video");
          if (
            video
              ? !(vid?.videoWidth && vid.getBoundingClientRect().height)
              : !!vid
          )
            return false;
          if (window.meter?.track !== track) {
            const c = new AudioContext(),
              a = c.createAnalyser();
            void c.resume();
            a.fftSize = 4096;
            c.createMediaStreamSource(stream).connect(a);
            window.meter = { c, a, track };
          }
          const { c, a } = window.meter,
            buf = new Float32Array(a.frequencyBinCount);
          a.getFloatFrequencyData(buf);
          const peak = Math.max(...buf);
          return (
            Number.isFinite(peak) &&
            Math.abs((buf.indexOf(peak) * c.sampleRate) / a.fftSize - hz) < 35
          );
        },
        { hz, video },
        { timeout: 45000 },
      );
    }
    await Promise.all([
      hear(listenA, 660, false),
      hear(listenB, 880, false),
      hear(onMain, 440, true),
    ]);
    console.log(
      "PASS live host on main stage plus two isolated talking teams, three distinct received tones and mobile listener",
    );
    const from = teams[0].find((m) => m.tag === "builder"),
      to = "idea/" + people[1].id;
    const oldTicket = await api(people[0], "media"),
      fixed = await api(people[1], "media");
    await board
      .locator("label[draggable]")
      .filter({ hasText: from.name })
      .dragTo(board.getByRole("region", { name: people[1].name + "的团队" }));
    await click("确认发布分组");
    await board
      .getByText("待发布", { exact: false })
      .waitFor({ state: "hidden" });
    const moved = people.find((p) => p.id === from.id);
    assert.equal((await api(moved, "view")).group, to);
    assert.equal((await api(moved, "media")).room, fixed.room);
    assert.notEqual((await api(people[0], "media")).room, oldTicket.room);
    await leadA.getByRole("button", { name: "开启麦克风" }).click();
    await hear(listenA, 660, false);
    console.log(
      "PASS host role selection, balanced distribution, published draft, stale version rejection and live drag reassignment",
    );
  } finally {
    await browser.close();
  }
}
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
