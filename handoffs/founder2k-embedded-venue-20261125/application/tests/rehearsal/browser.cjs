// Uses synthetic identities exclusively with the loopback Worker, and generated A/V.
const { chromium } = require("playwright-core");
const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const { id, members, meetings } = JSON.parse(readFileSync(process.argv[2]));
const base = "http://127.0.0.1:8790";
const pairA = meetings.find((m) => m.round === 1),
  pairB = meetings.find((m) => m.round === 1 && m.room !== pairA.room);
const member = (id) => members.find((m) => m.id === id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function run() {
  const start = Date.now(),
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM || "/usr/bin/chromium",
      headless: true,
      args: [
        "--no-sandbox",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    });
  try {
    async function user(m, mobile = false) {
      const ctx = await browser.newContext({
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1240, height: 900 },
        permissions: ["camera", "microphone"],
      });
      await ctx.route(base + "/**", (r) =>
        r.continue({
          headers: {
            ...r.request().headers(),
            "oai-authenticated-user-id": m.account,
            "oai-authenticated-user-email":
              m.account === "host"
                ? "host@venue.test"
                : m.account + "@venue.test",
          },
        }),
      );
      const page = await ctx.newPage();
      page.setDefaultTimeout(20000);
      // Frequency and visual markers let us distinguish stage media from private media.
      await page.addInitScript(
        ({ freq }) => {
          navigator.mediaDevices.getDisplayMedia = async () => {
            const canvas = document.createElement("canvas");
            canvas.width = 400;
            canvas.height = 240;
            const c = canvas.getContext("2d");
            const draw = () => {
              c.fillStyle = "#187047";
              c.fillRect(0, 0, 400, 240);
              c.fillStyle = "white";
              c.fillText("Founder2K presentation " + Date.now(), 10, 30);
            };
            draw();
            setInterval(draw, 200);
            return canvas.captureStream(5);
          };
          const original = navigator.mediaDevices.getUserMedia.bind(
            navigator.mediaDevices,
          );
          navigator.mediaDevices.getUserMedia = async (opts) => {
            if (!opts.audio) return original(opts);
            const ac = new AudioContext(),
              osc = ac.createOscillator(),
              out = ac.createMediaStreamDestination();
            osc.frequency.value = freq;
            osc.connect(out);
            osc.start();
            await ac.resume();
            window.__audio = ac;
            return out.stream;
          };
        },
        { freq: m.account === "host" ? 440 : 880 },
      );
      await page.goto(base + "/venue?id=" + id);
      await page.getByRole("textbox", { name: "确认报名姓名" }).fill(m.name);
      await page.getByRole("button", { name: "签到", exact: true }).click();
      await page.getByRole("button", { name: "离开会场" }).waitFor();
      return page;
    }
    const host = await user({ account: "host", name: "host@venue.test" });
    const [a, av, b] = await Promise.all([
      user(member(pairA.lead)),
      user(member(pairA.partner), true),
      user(member(pairB.lead)),
    ]);
    const api = (p, action, data = {}) =>
      p.evaluate(
        async ({ id, action, data }) => {
          const r = await fetch("/api/venue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id,
              action,
              device: sessionStorage.getItem("venue-device"),
              ...data,
            }),
          });
          return { status: r.status, body: await r.json() };
        },
        { id, action, data },
      );
    const check = async (p, act, d) => {
      const r = await api(p, act, d);
      assert.equal(r.status, 200, JSON.stringify(r.body));
      return r.body;
    };
    await host.getByRole("button", { name: "共享演示与主持人声音" }).click();
    const reception = async (page, hz, video) =>
      page.waitForFunction(
        ({ hz, video }) => {
          const media = [
            ...document.querySelectorAll(".venue-tracks audio"),
          ].find((el) => el.srcObject?.active);
          if (
            !media ||
            (video &&
              !document.querySelector(".venue-tracks video")?.videoWidth)
          )
            return false;
          let m = window.__meter;
          const track = media.srcObject.getAudioTracks()[0];
          if (!track) return false;
          if (!m || m.track !== track) {
            if (m) void m.ctx.close();
            const ctx = new AudioContext(),
              ana = ctx.createAnalyser();
            void ctx.resume();
            ana.fftSize = 4096;
            ctx.createMediaStreamSource(media.srcObject).connect(ana);
            window.__meter = m = { ctx, ana, track };
          }
          if (document.querySelectorAll(".venue-tracks audio").length !== 1)
            return false;
          const arr = new Float32Array(m.ana.frequencyBinCount);
          m.ana.getFloatFrequencyData(arr);
          let peak = 0;
          for (let i = 1; i < arr.length; i++) if (arr[i] > arr[peak]) peak = i;
          const frame = document.querySelector(".venue-tracks video");
          const rect = frame?.getBoundingClientRect();
          return (
            (!video || (rect && rect.width > 0 && rect.height > 0 && frame.readyState >= 2)) &&
            Number.isFinite(arr[peak]) &&
            Math.abs((peak * m.ctx.sampleRate) / m.ana.fftSize - hz) < 35
          );
        },
        { hz, video },
        { timeout: 45000 },
      );
    await Promise.all([reception(a, 440, true), reception(b, 440, true)]);
    console.log("Both groups received stage video and 440 Hz audio");
    const waitedFrom = Date.now();
    await sleep(121000);
    const before = await check(host, "view");
    const waiting = before.rooms.find((g) => g.id === pairB.lead);
    assert.ok(waiting.waited >= 120000, "wait alert after 120 seconds");
    const waitingView = await check(b, "view");
    assert.equal(waitingView.agenda[0].status, "尚未签到");
    console.log(
      "PASS wait alert after " +
        Math.round((Date.now() - waitedFrom) / 1000) +
        " seconds, missing visitor visible",
    );
    const competing = await Promise.all([
      api(host, "handoff", { revision: before.revision, groups: [pairA.lead] }),
      api(host, "handoff", { revision: before.revision, groups: [pairA.lead] }),
    ]);
    assert.deepEqual(competing.map((r) => r.status).sort(), [200, 409]);
    const handoff = Date.now();
    await a.waitForFunction(
      () =>
        document.querySelector(".venue-stage h2")?.textContent === "个人候场区",
    );
    await check(a, "admit", { round: 1 });
    await check(av, "admit", { round: 1 });
    await a.getByRole("button", { name: "开启麦克风" }).click();
    await reception(av, 880, false);
    await reception(b, 440, true);
    assert.equal(await av.locator(".venue-tracks video").count(), 0);
    console.log(
      "Private 880 Hz in A, presentation and 440 Hz in B; no presentation video in A",
    );
    assert.equal(
      await av.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
      true,
    );
    await av.getByRole("button", { name: "展开个人议程" }).click();
    assert.equal(await av.locator(".venue-agenda li").count(), 6);
    await check(av, "end");
    await check(av, "help", { text: "彩排补谈" });
    await check(host, "notify", {
      revision: (await check(host, "view")).revision,
      text: "请继续当前会谈",
    });
    await reception(b, 440, true);
    await b.reload();
    await reception(b, 440, true);
    console.log(
      "PASS returning from the original activity URL resumes the current stage on the same device",
    );
    await sleep(Math.max(0, 60000 - (Date.now() - handoff)));
    await check(host, "handoff", {
      revision: (await check(host, "view")).revision,
      groups: [pairB.lead],
    });
    await b.waitForFunction(
      () =>
        document.querySelector(".venue-stage h2")?.textContent === "个人候场区",
    );
    await check(host, "recall", {
      revision: (await check(host, "view")).revision,
    });
    await check(av, "leave");
    await reception(b, 440, true);
    const after = await check(av, "view");
    assert.equal(after.checked, false);
    console.log(
      JSON.stringify({
        passed: true,
        accounts: 4,
        physicalDevices: 0,
        elapsedSeconds: (Date.now() - start) / 1000,
        handoffSpacingSeconds: (Date.now() - handoff) / 1000,
      }),
    );
  } finally {
    await browser.close();
  }
}
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
