// Start a fresh, local-only rehearsal. No hosted API keys or production database.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { createServer } from "node:net";

const root = process.cwd(),
  tmp = mkdtempSync(join(tmpdir(), "founder2k-rehearsal-"));
const config = resolve("dist/server/wrangler.json"),
  binary = process.env.LIVEKIT_SERVER || "livekit-server";
const bindings = resolve("dist/server/.dev.vars");
if (!existsSync(config)) throw Error("Build the Sites application first.");
if (existsSync(bindings))
  throw Error("Use a fresh build directory without existing .dev.vars.");
for (const port of [7880, 7881, 8790])
  await new Promise((ok, no) => {
    const s = createServer();
    s.once("error", no);
    s.listen(port, "127.0.0.1", () => s.close(ok));
  });
const secret = randomBytes(32).toString("hex"),
  clock = randomBytes(32).toString("hex");
const runtime = {
  ...process.env,
  XDG_CONFIG_HOME: tmp,
  WRANGLER_SEND_METRICS: "false",
};
const worker = [
  "--import",
  "./scripts/sites-env.mjs",
  "./node_modules/wrangler/bin/wrangler.js",
];
const instances = [];
function command(args) {
  const result = spawnSync(process.execPath, args, {
    env: runtime,
    stdio: "inherit",
  });
  if (result.status !== 0) throw Error("Local command failed: " + args[0]);
}
function start(program, args, env = runtime) {
  const child = spawn(program, args, {
    env,
    cwd: root,
    stdio: ["ignore", "ignore", "inherit"],
  });
  instances.push(child);
  return child;
}
async function ready(url) {
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await sleep(200);
  }
  throw Error("Service did not start: " + url);
}
let wrote = false;
function cleanup() {
  for (const child of [...instances].reverse()) child.kill();
  if (wrote && existsSync(bindings)) unlinkSync(bindings);
  wrote = false;
}
process.on("SIGTERM", () => {
  cleanup();
  process.exit(1);
});
process.on("SIGINT", () => {
  cleanup();
  process.exit(1);
});
try {
  const media = join(tmp, "sfu.yml");
  writeFileSync(
    media,
    `port: 7880
bind_addresses: ["127.0.0.1"]
rtc:
  node_ip: 127.0.0.1
  use_external_ip: false
  tcp_port: 7881
  udp_port: 7882
  enable_loopback_candidate: true
room:
  auto_create: false
keys:
  rehearsal: ${secret}
webhook:
  api_key: rehearsal
  urls: ["http://127.0.0.1:8790/api/venue/webhook"]
`,
    { mode: 0o600 },
  );
  writeFileSync(
    bindings,
    `LIVEKIT_URL=ws://127.0.0.1:7880\nLIVEKIT_API_KEY=rehearsal\nLIVEKIT_API_SECRET=${secret}\nVENUE_CLOCK_KEY=${clock}\nFOUNDER2K_ADMIN_EMAIL=host@venue.test\n`,
    { flag: "wx", mode: 0o600 },
  );
  wrote = true;
  const sql = join(tmp, "session.sql"),
    manifest = join(tmp, "manifest.json");
  command([
    "--experimental-strip-types",
    "/tmp/f2k-preview/seed.mts",
    sql,
    manifest,
  ]);
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json"));
  for (const file of [
    ...journal.entries.map((e) => "drizzle/" + e.tag + ".sql"),
    sql,
  ]) {
    command([
      ...worker,
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      config,
      "--persist-to",
      tmp,
      "--file",
      file,
    ]);
  }
  start(binary, ["--config", media]);
  await ready("http://127.0.0.1:7880/");
  start(process.execPath, [
    ...worker,
    "dev",
    "--config",
    config,
    "--local",
    "--persist-to",
    tmp,
    "--ip",
    "127.0.0.1",
    "--port",
    "8790",
    "--inspector-port",
    "0",
  ]);
  await ready("http://127.0.0.1:8790/venue");
  start(process.execPath, ["scripts/venue-clock.mjs"], {
    ...runtime,
    VENUE_CLOCK_KEY: clock,
    VENUE_SITE_URL: "http://127.0.0.1:8790",
  });
  if (!process.argv.includes("--server-checks")) {
    const test = spawn(
      process.execPath,
      ["/tmp/f2k-preview/capture.cjs", manifest],
      { env: runtime, stdio: "inherit" },
    );
    instances.push(test);
    const status = await new Promise((resolve) => test.once("exit", resolve));
    if (status !== 0) throw Error("Browser rehearsal failed");
  }
} finally { cleanup(); }