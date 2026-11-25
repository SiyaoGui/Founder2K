// Writes SQL for a new synthetic instance. Apply only to an isolated local D1 database.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { schedule } from "/workspace/sites-validation/app/women-matching.ts";
const [sqlFile, manifest] = process.argv.slice(2);
if (!sqlFile || !manifest)
  throw Error(
    "Usage: node --experimental-strip-types tests/rehearsal/seed.mjs OUTPUT.sql MANIFEST.json",
  );
const id = randomUUID();
const members = Array.from({ length: 12 }, (_, i) => ({
  id: randomUUID(),
  name: ["林悦","周彤","杨清","许宁","方瑶","宋雅","陈禾","吴桐","江澜","陆明","程安","余乐"][i],
  role: i < 6 ? "项目发起人" : "共创伙伴",
  account: "rehearsal-" + i,
  topic: i < 6 ? ["无障碍硬件","社区照护","节能传感器","手语学习","社区菜园","远程康复"][i] : "研究与开发",
  availability: "测试时段",
  choices: [],
  open: true,
}));
const meetings = schedule(members);
const session = {
  title: "女性共创匹配日 · 彩排",
  start: new Date(Date.now() - 11 * 60000).toISOString(),
  revision: 1,
  published: true,
  members,
  meetings,
  invites: [],
  teams: {},
  submitted: [],
  feedback: {},
};
const q = (x) => "'" + String(x).replaceAll("'", "''") + "'";
writeFileSync(
  sqlFile,
  "INSERT INTO her_entries(id,kind,author,target,state,data,updated) VALUES(" +
    [
      id,
      "women-program",
      "local-rehearsal",
      "",
      "private",
      JSON.stringify(session),
      Date.now(),
    ]
      .map(q)
      .join(",") +
    ");\n",
);
writeFileSync(manifest, JSON.stringify({ id, members, meetings }, null, 2));
