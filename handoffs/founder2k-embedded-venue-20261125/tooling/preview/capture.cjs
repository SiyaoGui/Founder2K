// Uses synthetic identities exclusively with the loopback Worker, and generated A/V.
const { chromium } = require("/workspace/sites-validation/node_modules/playwright-core");
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
            canvas.width = 800;
            canvas.height = 450;
            const c = canvas.getContext("2d");
            const draw = () => {
              c.fillStyle = "#187047";
              c.fillRect(0, 0, 800, 450);
              c.fillStyle = "white";
              c.font="26px sans-serif"; c.fillText("Founder2K  /  女性共创匹配日",48,72); c.font="bold 64px sans-serif"; c.fillText("开场介绍",48,225); c.font="28px sans-serif"; c.fillText("六轮会面安排与转场说明",48,294);
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
          if (!m || m.media !== media) {
            const ctx = new AudioContext(),
              ana = ctx.createAnalyser();
            void ctx.resume();
            ana.fftSize = 4096;
            ctx.createMediaStreamSource(media.srcObject).connect(ana);
            window.__meter = m = { ctx, ana, media };
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

    await reception(av,440,true);
    await sleep(6500);
    await reception(av,440,true);
    const dir="/workspace/shared/downloads/venue-preview/";
    const shot=async(p,name)=>p.screenshot({path:dir+name+".png",animations:"disabled"});
    await av.evaluate(()=>scrollTo(0,0));
    console.log("VISIBLE", await av.locator(".venue-tracks video").evaluateAll(vs=>JSON.stringify(vs.map(v=>({w:v.videoWidth,h:v.videoHeight,rect:v.getBoundingClientRect(),styles:[v,v.parentElement].map(x=>[x.tagName,x.className,getComputedStyle(x).display,getComputedStyle(x).width,getComputedStyle(x).height,x.getAttribute("style")]),paused:v.paused})))));
    await shot(av,"mobile");
    await av.getByRole("button",{name:"展开个人议程"}).click();
    await shot(av,"mobile-agenda");
    await av.setViewportSize({width:1240,height:900});
    await av.evaluate(()=>scrollTo(0,0));
    await shot(av,"participant");
    await check(host,"handoff",{revision:(await check(host,"view")).revision,groups:[pairA.lead]});
    await a.waitForFunction(()=>document.querySelector(".venue-stage h2")?.textContent==="个人候场区");
    await check(a,"admit",{round:1});
    await check(av,"admit",{round:1});
    await a.getByRole("button",{name:"开启麦克风"}).click();
    await reception(av,880,false);
    await check(b,"help",{text:"申请补谈"});
    await host.locator(".venue-console").getByText("申请补谈",{exact:false}).first().waitFor();
    for (const [page,key] of [[host,"host"],[a,"manager"]]){
      const console=page.locator(".venue-console");
      if(key==="manager") await console.screenshot({path:dir+key+".png"});
      else {
        await console.evaluate(e=>e.scrollIntoView({block:"start"}));
        await shot(page,key);
        await page.getByRole("button",{name:"恢复向指定组分发演示",exact:false}).first().count();
      }
    }
    console.log("Captured previews from live event");
  } finally { await browser.close(); }
}
run().catch(e=>{console.error(e.message);process.exitCode=1});
