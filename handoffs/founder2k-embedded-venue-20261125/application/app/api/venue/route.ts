import { env } from "cloudflare:workers";
import { z } from "zod";
import { getChatGPTUser } from "../../chatgpt-auth";
import { readSource, requireVenue as need, VenueError } from "./source";
import { available, grant, service, closeRoom, preparePair } from "./media";
import { roleTags, ideaRoom, type RoleTag } from "../../venue/grouping";
export const dynamic = "force-dynamic";
const db = () => env.DB!;
type Group = {
  mode: "stage" | "discussion";
  epoch: string;
  manager: string;
  handoff: number;
  closing?: { oldRoom: string };
  retiring?: boolean;
};
type Control = {
  teamPlan?: Record<string, { tag: RoleTag; group?: string }>;
  rev: number;
  groups: Record<string, Group>;
  notice: string;
  duration: number;
  gap: number;
  wait: number;
  bookings?: { round: number; room: number; lead: string; partner: string }[];
  speakers?: string[];
  queue?: string[];
  verified?: string[];
  dispatchers?: string[];
  formerSpeakers?: string[];
  followups?: Record<
    string,
    { from: string; to: string; choice: string; agreed: boolean }
  >;
  anchor?: number;
  visits?: Record<string, { group: string; approved: boolean }>;
  offsets?: Record<string, number>;
  extensions?: Record<string, number>;
};
type Presence = {
  member: string;
  device: string;
  at: number;
  entered: number;
  left: boolean;
  early: string;
  skip: string;
  help: string;
  automatic: boolean;
  joined?: string;
  skipped?: string[];
};
type Live = {
  id: string;
  host_account: string;
  visitor_account: string;
  logical_room: string;
  media_generation: string | null;
  media_connected_ms: number | null;
  media_closed_ms: number | null;
  planned_end_ms: number;
};
const reply = (x: unknown, status = 200) =>
  Response.json(x, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const input = z.object({
  id: z.string().uuid(),
  action: z.enum([
    "view",
    "rehearse",
    "teamPlan",
    "check",
    "pulse",
    "ready",
    "skip",
    "leave",
    "help",
    "notify",
    "handoff",
    "restore",
    "recall",
    "delegate",
    "admit",
    "end",
    "media",
    "settings",
    "book",
    "lineup",
    "call",
    "extend",
    "requestSlot",
    "acceptVisit",
    "visit",
    "shift",
    "offstage",
    "resolve",
    "verify",
    "dispatchRole",
    "follow",
    "respondFollow",
  ]),
  plan: z
    .array(
      z.object({
        id: z.string().max(100),
        tag: z.enum(roleTags),
        group: z.string().max(120),
      }),
    )
    .max(100)
    .optional(),
  teamTag: z.enum(roleTags).optional(),
  device: z.string().uuid().optional(),
  text: z.string().max(400).default(""),
  group: z.string().max(100).default(""),
  groups: z.array(z.string().max(100)).max(100).default([]),
  partner: z.string().max(100).default(""),
  round: z.number().int().min(1).max(100).default(1),
  revision: z.number().int().default(-1),
  delay: z.number().int().min(0).max(300).default(0),
  automatic: z.boolean().default(false),
  duration: z.number().int().min(1).max(180).default(15),
  gap: z.number().int().min(0).max(60).default(2),
  wait: z.number().int().min(10).max(1800).default(120),
});
export async function POST(req: Request) {
  try {
    need(
      req.headers.get("origin") === new URL(req.url).origin,
      403,
      "来源无效",
    );
    const actor = await getChatGPTUser();
    need(actor, 401, "请登录现有账户");
    const u = actor;
    const a = input.parse(await req.json());
    async function dispatch(): Promise<Response | null> {
      const s = await readSource(a.id),
        now = Date.now();
      const admin =
        u.email.toLowerCase() ===
        (
          env.FOUNDER2K_ADMIN_EMAIL ??
          (import.meta.env.DEV ? "seedy@sites.test" : "")
        ).toLowerCase();
      const self = s.people.find((p) => p.account === u.userId);
      need(self || admin, 403, "仅限本场已报名成员及主持人");
      const me = self?.id || "host",
        name = self?.name || u.displayName;
      if (a.action === "rehearse") {
        need(admin && !s.rehearsalOf, 403, "仅总主持人可从正式活动创建彩排");
        const rehearsalId = crypto.randomUUID();
        await db()
          .prepare(
            "INSERT INTO her_entries(id,kind,author,target,state,data,updated) VALUES(?,'venue-rehearsal',?,?,'private','{}',?)",
          )
          .bind(rehearsalId, u.userId, a.id, now)
          .run();
        return reply({ rehearsalId });
      }
      const key = "venue/control/" + a.id;
      const audit = (action: string, detail: Record<string, unknown> = {}) =>
        db()
          .prepare(
            "INSERT INTO her_entries(id,kind,author,target,state,data,updated) VALUES(?,'venue-log',?,?,'private',?,?)",
          )
          .bind(
            crypto.randomUUID(),
            u.userId,
            a.id,
            JSON.stringify({ action, member: me, ...detail }),
            now,
          );
      const initial: Control = {
        rev: 0,
        groups: {},
        notice: "",
        duration: 15,
        gap: 2,
        wait: 120,
      };
      for (const p of s.people)
        if (p.group && !initial.groups[p.group])
          initial.groups[p.group] = {
            mode: "stage",
            epoch: crypto.randomUUID(),
            manager: s.matching ? p.group : "host",
            handoff: 0,
          };
      const sql = db();
      const ensure = sql
        .prepare(
          "INSERT OR IGNORE INTO her_entries(id,kind,author,target,state,data,updated) VALUES(?,'venue-control','system',?,'private',?,?)",
        )
        .bind(key, a.id, JSON.stringify(initial), now);
      const readControl = () =>
        sql
          .prepare("SELECT data FROM her_entries WHERE id=?")
          .bind(key)
          .first<{ data: string }>();
      let old = await readControl();
      if (!old) {
        await ensure.run();
        old = await readControl();
      }
      need(old, 503, "会场暂不可用");
      const c = JSON.parse(old.data) as Control;
      if (s.format === "导师答疑") {
        s.meetings = c.bookings || [];
        for (const m of s.meetings) {
          const lead = s.people.find((p) => p.id === m.lead),
            visitor = s.people.find((p) => p.id === m.partner);
          if (lead) lead.group = lead.id;
          if (visitor && !visitor.group) visitor.group = m.lead;
        }
      }
      const flash = s.format === "创业快闪";
      const enrolledGroups = new Set(s.people.map((member) => member.group));
      if (flash) {
        c.groups.lobby ??= {
          manager: "host",
          epoch: "main",
          handoff: 0,
          mode: "stage",
        };
        for (const id of enrolledGroups)
          if (id && !c.groups[id])
            c.groups[id] = {
              manager: "host",
              epoch: "original-" + id,
              handoff: 0,
              mode: "stage",
            };
        for (const member of s.people) {
          const group = c.teamPlan?.[member.id]?.group;
          if (group && member.role !== "旁听") member.group = group;
        }
      }
      const teamLabel = (id: string) =>
        id === "lobby"
          ? "主会场"
          : id.startsWith("idea/")
            ? (s.people.find((m) => ideaRoom(m.id) === id)?.name || "项目") +
              "的团队"
            : id === "audience"
              ? "观众席"
              : "";
      const currentRev = c.rev;
      const dispatcher = !!self && !!c.dispatchers?.includes(me);
      const changes = async () => {
        c.rev++;
        const r = await sql
          .prepare(
            "UPDATE her_entries SET data=?,updated=? WHERE id=? AND updated IS NOT NULL AND json_extract(data,'$.rev')=?",
          )
          .bind(JSON.stringify(c), now, key, currentRev)
          .run();
        need(r.meta.changes, 409, "调度已更新，请按最新状态操作");
      };
      const recs = await sql
        .prepare(
          "SELECT data FROM her_entries WHERE kind='venue-presence' AND target=?",
        )
        .bind(a.id)
        .all<{ data: string }>();
      const pres = new Map<string, Presence>(
        recs.results.map((r) => {
          const p = JSON.parse(r.data) as Presence;
          return [p.member, p];
        }),
      );
      const p = pres.get(me),
        person = (id: string) => s.people.find((v) => v.id === id);
      const label = (id: string) => {
        const member = person(id);
        if (!member) return "";
        const duplicate = s.people.some(
          (x) => x.id !== id && x.name === member.name,
        );
        return duplicate
          ? [member.name, member.role, member.topic].filter(Boolean).join(" · ")
          : member.name;
      };
      const mediaName = self
        ? [
            label(me),
            c.groups[groupForManager()]?.manager === me
              ? "分组管理员"
              : self.role,
          ].join(" · ")
        : name + " · 总主持人";
      function groupForManager() {
        return (
          Object.keys(c.groups).find((k) => c.groups[k].manager === me) || ""
        );
      }
      const all = await sql
        .prepare(
          "SELECT m.*,a.media_generation FROM venue_meetings m LEFT JOIN venue_admissions a ON a.meeting_id=m.id WHERE event_id=?",
        )
        .bind(a.id)
        .all<Live>();
      const live = all.results;
      const first = c.anchor ?? s.start + 600000,
        begin = (r: number) => first + (r - 1) * (c.duration + c.gap) * 60000;
      const mid = (m: { round: number; lead: string; partner: string }) =>
        [a.id, m.round, m.lead, m.partner].join(".");
      const starts = (m: { round: number; lead: string; partner: string }) =>
        begin(m.round) + (c.offsets?.[mid(m)] || 0);
      const end = (m: { round: number; lead: string; partner: string }) =>
        c.extensions?.[mid(m)] ?? starts(m) + c.duration * 60000;
      const own = s.meetings
        .filter((m) => m.lead === me || m.partner === me)
        .sort((a, b) => starts(a) - starts(b));
      const meeting = own.find((m) => m.round === a.round);
      const active = live.find(
        (l) =>
          l.media_generation &&
          (l.host_account === u.userId || l.visitor_account === u.userId),
      );
      const privateFollow =
        active &&
        s.format === "路演" &&
        active.logical_room.startsWith("follow/");
      const current = own.find(
        (m) =>
          now < end(m) &&
          !live.find((l) => l.id === mid(m))?.media_closed_ms &&
          p?.skip !== mid(m) &&
          !p?.skipped?.includes(mid(m)),
      );
      const visit = c.visits?.[me];
      const group =
        visit?.approved && !s.matching
          ? visit.group
          : self?.role === "项目发起人" ||
              (s.format === "导师答疑" && s.meetings.some((m) => m.lead === me))
            ? me
            : current?.lead || self?.group || (flash && admin ? "lobby" : "");
      const stage = (id: string) =>
        "presentation." + a.id + "." + c.groups[id].epoch;
      const team = (id: string) => "team." + a.id + "." + c.groups[id].epoch;
      const close = async (l: Live) => {
        if (!l.media_generation) return;
        await closeRoom(l.media_generation);
        await sql
          .prepare(
            "UPDATE venue_meetings SET media_closed_ms=? WHERE id=? AND media_closed_ms IS NULL AND EXISTS(SELECT 1 FROM venue_admissions WHERE meeting_id=? AND media_generation=?)",
          )
          .bind(Date.now(), l.id, l.id, l.media_generation)
          .run();
      };
      // A recall is durable before remote cleanup. Retries close the old generation
      // before any client receives the replacement room.
      const closing = Object.entries(c.groups).filter(([, g]) => g.closing);
      if (closing.length) {
        for (const [id, g] of closing) {
          if (available()) await closeRoom(g.closing!.oldRoom);
          for (const l of live.filter(
            (l) =>
              (l.logical_room === id ||
                (id === "auditorium" &&
                  l.logical_room.startsWith("follow/"))) &&
              l.media_generation,
          ))
            await close(l);
          delete g.closing;
          if (g.retiring) delete c.groups[id];
        }
        try {
          await changes();
        } catch (error) {
          if (!(error instanceof VenueError && error.status === 409))
            throw error;
        }
        return null;
      }
      if (a.action === "check") {
        need(a.device && a.text === name, 400, "请确认报名姓名");
        if (p && !p.left && p.device !== a.device && active)
          await close(active);
        const tagPath = "$.teamPlan." + JSON.stringify(me) + ".tag";
        const declaration =
          flash &&
          self &&
          self.role !== "旁听" &&
          a.teamTag &&
          a.teamTag !== "unset"
            ? [
                sql
                  .prepare(
                    "UPDATE her_entries SET data=json_set(data,?,?,'$.rev',json_extract(data,'$.rev')+1),updated=? WHERE id=? AND json_extract(data,?) IS NULL",
                  )
                  .bind(tagPath, a.teamTag, now, key, tagPath),
              ]
            : [];
        const next: Presence = {
          member: me,
          device: a.device,
          at: now,
          entered: now,
          left: false,
          early: "",
          skip: p?.skip || "",
          skipped: p?.skipped || [],
          automatic: a.automatic,
          help: "",
        };
        await sql.batch([
          sql
            .prepare(
              "INSERT INTO her_entries(id,kind,author,target,state,data,updated) VALUES(?,'venue-presence',?,?,'private',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated",
            )
            .bind(key + "/" + me, u.userId, a.id, JSON.stringify(next), now),
          ...declaration,
          audit("check", { name, automatic: a.automatic }),
        ]);
        return reply({ ok: true });
      }
      if (a.action !== "view") {
        need(
          a.device && p && !p.left && p.device === a.device,
          409,
          "请在当前设备重新签到",
        );
      }
      if (a.action === "teamPlan") {
        need(admin && flash, 403, "仅快闪总主持人可发布团队分组");
        need(c.rev === a.revision, 409, "分组已有更新，请重新预览");
        const edits = a.plan || [];
        need(
          edits.length && new Set(edits.map((x) => x.id)).size === edits.length,
          400,
          "请选择成员且每人只分配一次",
        );
        const eligible = s.people.filter((m) => m.role !== "旁听");
        const assignments = new Map(
          eligible.map((m) => [
            m.id,
            {
              id: m.id,
              tag: c.teamPlan?.[m.id]?.tag || "unset",
              group: m.group,
            },
          ]),
        );
        const affected = new Set<string>();
        for (const e of edits) {
          const previous = assignments.get(e.id);
          need(previous, 400, "名单已变化，请重新预览");
          if (previous.group !== e.group) {
            affected.add(
              c.visits?.[e.id]?.approved
                ? c.visits[e.id].group
                : previous.group,
            );
            if (c.visits) delete c.visits[e.id];
          }
          assignments.set(e.id, e);
        }
        const targets = new Set(
          [...assignments.values()]
            .filter((x) => x.tag === "idea" && x.group === ideaRoom(x.id))
            .map((x) => x.group),
        );
        for (const row of assignments.values()) {
          need(
            row.group === "lobby" ||
              targets.has(row.group) ||
              (enrolledGroups.has(row.group) && row.group !== "audience"),
            400,
            "请先将该组成员移到有效团队，并保留每组的发起人",
          );
          need(
            row.tag !== "idea" ||
              !row.group.startsWith("idea/") ||
              row.group === ideaRoom(row.id),
            400,
            "每个创意团队只能有一位 idea 发起人",
          );
        }
        for (const groupId of targets)
          c.groups[groupId] ??= {
            mode: "stage",
            manager: groupId.slice(5),
            epoch: crypto.randomUUID(),
            handoff: 0,
          };
        for (const [id, g] of Object.entries(c.groups)) {
          if (!id.startsWith("idea/") || targets.has(id)) continue;
          g.retiring = true;
          g.closing = { oldRoom: g.mode === "stage" ? stage(id) : team(id) };
          for (const [visitor, visit] of Object.entries(c.visits || {}))
            if (visit.group === id) delete c.visits![visitor];
        }
        for (const e of edits)
          (c.teamPlan ??= {})[e.id] = { tag: e.tag, group: e.group };
        for (const groupId of affected) {
          const g = c.groups[groupId];
          if (!g || g.retiring || g.mode !== "discussion") continue;
          g.closing = { oldRoom: team(groupId) };
          g.epoch = crypto.randomUUID();
        }
        await changes();
        await audit("teamPlan", { members: edits.length }).run();
        return reply({ ok: true });
      }
      if (["pulse", "leave", "skip", "ready", "help"].includes(a.action)) {
        need(p, 409, "请签到");
        if (a.action === "ready" || a.action === "skip")
          need(meeting, 404, "本轮空档");
        if (a.action === "ready")
          need(!active && current === meeting, 409, "请先完成上一场");
        if (
          active &&
          (a.action === "leave" ||
            (a.action === "skip" && active.id === mid(meeting!)))
        )
          await close(active);
        if (a.action === "skip")
          await sql
            .prepare(
              "UPDATE her_entries SET data=json_set(data,'$.skipped',json(?)) WHERE id=? AND json_extract(data,'$.device')=?",
            )
            .bind(
              JSON.stringify([
                ...new Set([...(p.skipped || []), mid(meeting!)]),
              ]),
              key + "/" + me,
              a.device,
            )
            .run();
        const fields: Record<string, string | number> = { at: now };
        if (a.action === "ready") fields.early = mid(meeting!);
        if (a.action === "skip") {
          fields.skip = mid(meeting!);
          fields.early = "";
        }
        if (a.action === "leave") {
          fields.early = "";
          fields.left = 1;
        }
        if (a.action === "help") fields.help = a.text.trim() || "请求协助";
        const args = Object.entries(fields).flatMap(([k, v]) => ["$." + k, v]);
        const saved = await sql
          .prepare(
            "UPDATE her_entries SET data=json_set(data," +
              Object.keys(fields)
                .map(() => "?,?")
                .join(",") +
              "),updated=? WHERE id=? AND json_extract(data,'$.device')=? AND NOT json_extract(data,'$.left')",
          )
          .bind(...args, now, key + "/" + me, a.device)
          .run();
        need(saved.meta.changes, 409, "签到状态已变化");
        if (a.action !== "pulse")
          await audit(a.action, { round: a.round }).run();
        return reply({ ok: true });
      }
      if (a.action === "follow" || a.action === "respondFollow") {
        need(self && p && c.rev === a.revision, 409, "请按最新议程操作");
        const choices = (c.followups ??= {});
        const peer = person(a.partner);
        need(peer && peer.id !== me, 400, "请选择对方");
        const pair = [me, peer.id].sort().join("."),
          item = choices[pair];
        if (a.action === "follow") {
          need(["补谈", "试合作"].includes(a.text), 400, "请选择后续安排");
          const met = own.some(
            (m) =>
              (m.lead === peer.id || m.partner === peer.id) &&
              live.some(
                (l) =>
                  l.id === mid(m) && l.media_connected_ms && l.media_closed_ms,
              ),
          );
          need(
            met || (s.format === "路演" && c.formerSpeakers?.includes(peer.id)),
            403,
            "当前不能申请会后交流",
          );
          need(!item, 409, "已有意向待处理");
          choices[pair] = {
            from: me,
            to: peer.id,
            choice: a.text,
            agreed: false,
          };
        } else {
          need(
            item && item.from === peer.id && item.to === me && !item.agreed,
            409,
            "没有待处理的邀请",
          );
          if (a.text === "同意") item.agreed = true;
          else delete choices[pair];
        }
        await changes();
        return reply({ ok: true });
      }
      if (
        ["visit", "acceptVisit", "requestSlot", "resolve"].includes(a.action)
      ) {
        need(a.revision === c.rev, 409, "安排有更新，请重试");
        const g = c.groups[a.group];
        need(g, 404, "找不到分组");
        if (a.action === "visit") {
          need(
            !s.matching &&
              s.format === "创业快闪" &&
              self &&
              self.role !== "旁听" &&
              !active,
            403,
            "当前无法申请巡组",
          );
          (c.visits ??= {})[me] = { group: a.group, approved: false };
          await changes();
        } else if (a.action === "acceptVisit") {
          const visit = c.visits?.[a.text];
          need(
            (admin || g.manager === me || self?.group === a.group) &&
              visit?.group === a.group,
            403,
            "仅本组可接待申请人",
          );
          visit.approved = true;
          await changes();
        } else if (a.action === "requestSlot") {
          need(g.manager === me || admin, 403, "需要分组权限");
          await sql
            .prepare(
              "UPDATE her_entries SET data=json_set(data,'$.help',?) WHERE id=?",
            )
            .bind("申请补位 · " + a.text, key + "/" + me)
            .run();
        } else {
          need(admin || g.manager === me, 403, "需要管理权限");
          const assisted = person(a.text);
          need(
            assisted &&
              (admin ||
                assisted.group === a.group ||
                s.meetings.some(
                  (m) => m.lead === a.group && m.partner === assisted.id,
                )),
            403,
            "不在本组",
          );
          await sql
            .prepare(
              "UPDATE her_entries SET data=json_set(data,'$.help','') WHERE id=?",
            )
            .bind(key + "/" + a.text)
            .run();
        }
        return reply({ ok: true });
      }
      if (
        [
          "notify",
          "restore",
          "recall",
          "handoff",
          "delegate",
          "settings",
          "book",
          "lineup",
          "call",
          "extend",
          "shift",
          "offstage",
          "verify",
          "dispatchRole",
        ].includes(a.action)
      ) {
        need(
          admin || (dispatcher && a.action === "shift"),
          403,
          "需要本场调度权限",
        );
        need(currentRev === a.revision, 409, "影响范围已有变化，请重新确认");
        const groups =
          a.action === "recall"
            ? Object.keys(c.groups)
            : [...new Set(a.groups)];
        if (a.action === "dispatchRole") {
          need(admin && person(a.text), 403, "请选择本场成员");
          c.dispatchers = (c.dispatchers || []).filter((id) => id !== a.text);
          if (a.automatic) c.dispatchers.push(a.text);
          await changes();
          await audit("dispatchRole", {
            subject: a.text,
            enabled: a.automatic,
          }).run();
          return reply({ ok: true });
        } else if (a.action === "verify") {
          need(person(a.text), 400, "请选择已签到成员");
          need(pres.has(a.text), 409, "尚未签到");
          c.verified = [...new Set([...(c.verified || []), a.text])];
          await changes();
          await audit("verify", { subject: a.text }).run();
          return reply({ ok: true });
        } else if (a.action === "offstage") {
          need(c.speakers?.includes(a.text), 409, "成员已下台");
          c.speakers = (c.speakers || []).filter((id) => id !== a.text);
          c.formerSpeakers = [
            ...new Set([...(c.formerSpeakers || []), a.text]),
          ];
          const g = c.groups.auditorium;
          need(g, 409, "舞台尚未就绪");
          g.closing = { oldRoom: stage("auditorium") };
          g.epoch = crypto.randomUUID();
          await changes();
          return reply({ ok: true });
        } else if (a.action === "shift") {
          const m = s.meetings.find(
            (m) => m.round === a.round && m.lead === a.group,
          );
          need(
            m && !live.some((l) => l.id === mid(m)),
            409,
            "只能调整尚未开始的会面",
          );
          const offset = a.delay * 1000,
            from = begin(m.round) + offset,
            to = from + c.duration * 60000;
          need(
            to > now &&
              !s.meetings.some(
                (q) =>
                  q !== m &&
                  (q.lead === m.lead || q.partner === m.partner) &&
                  starts(q) < to &&
                  end(q) > from,
              ),
            409,
            "调整会与其他约谈冲突",
          );
          (c.offsets ??= {})[mid(m)] = offset;
        } else if (a.action === "book") {
          need(
            s.format === "导师答疑" &&
              a.group !== a.partner &&
              person(a.group) &&
              person(a.partner),
            400,
            "请选择导师与预约人",
          );
          const list = (c.bookings ??= []);
          need(
            !list.some(
              (m) =>
                m.round === a.round &&
                [m.lead, m.partner].some((id) =>
                  [a.group, a.partner].includes(id),
                ),
            ),
            409,
            "本轮已有预约",
          );
          if (!list.length) c.anchor = now + 60000;
          need(
            (c.anchor ?? first) + (a.round - 1) * (c.duration + c.gap) * 60000 >
              now,
            409,
            "此时段已开始",
          );
          list.push({
            round: a.round,
            room: 0,
            lead: a.group,
            partner: a.partner,
          });
          c.groups[a.group] ??= {
            mode: "stage",
            manager: a.group,
            epoch: crypto.randomUUID(),
            handoff: 0,
          };
        } else if (a.action === "lineup" || a.action === "call") {
          need(
            s.format === "路演" && person(a.text)?.role === "参与者",
            400,
            "请选择正式参加者",
          );
          const queue = (c.queue ??= []),
            speakers = (c.speakers ??= []);
          if (a.action === "lineup") {
            need(
              !queue.includes(a.text) && !speakers.includes(a.text),
              409,
              "已在候场或台上",
            );
            queue.push(a.text);
          } else {
            need(
              queue[0] === a.text && speakers.length < 9,
              409,
              "轮到下一位或已达到舞台上限",
            );
            queue.shift();
            speakers.push(a.text);
          }
        } else if (a.action === "extend") {
          const m = s.meetings.find(
              (m) => m.round === a.round && m.lead === a.group,
            ),
            l = m && live.find((l) => l.id === mid(m));
          need(
            m && l?.media_generation && end(m) > now,
            409,
            "当前会谈无法延长",
          );
          const until = end(m) + 60000;
          need(
            !s.meetings.some(
              (q) =>
                q.round > m.round &&
                begin(q.round) < until &&
                (q.lead === m.lead || q.partner === m.partner),
            ),
            409,
            "延长会占用后续预约，请先协调补谈",
          );
          (c.extensions ??= {})[mid(m)] = until;
          c.rev++;
          const [written] = await sql.batch([
            sql
              .prepare(
                "UPDATE her_entries SET data=?,updated=? WHERE id=? AND json_extract(data,'$.rev')=?",
              )
              .bind(JSON.stringify(c), now, key, currentRev),
            sql
              .prepare(
                "UPDATE venue_meetings SET planned_end_ms=? WHERE id=? AND media_closed_ms IS NULL AND changes()=1",
              )
              .bind(until, mid(m)),
          ]);
          need(written.meta.changes, 409, "其他调度员已更新安排");
          return reply({ ok: true });
        } else if (a.action === "notify") c.notice = a.text;
        else if (a.action === "settings") {
          need(!live.length && now < first, 409, "仅能在轮转开始前配置");
          Object.assign(c, { duration: a.duration, gap: a.gap, wait: a.wait });
        } else {
          need(
            groups.length && groups.every((k) => Object.hasOwn(c.groups, k)),
            400,
            "请选择有效分组",
          );
          for (const k of groups) {
            const g = c.groups[k];
            if (a.action === "delegate") {
              need(
                a.text === "host" || !!person(a.text),
                400,
                "请选择本场成员",
              );
              g.manager = a.text === "host" ? me : a.text;
              continue;
            }
            if (a.action === "handoff") {
              need(
                !flash || k !== "lobby",
                400,
                "主会场保留给总主持人，请选择讨论组",
              );
              const manager = pres.get(
                g.manager === "host" && admin ? me : g.manager,
              );
              need(
                manager && !manager.left && now - manager.at < 45000,
                409,
                "接班人离线，请先指定替补或代管",
              );
              g.handoff = now + a.delay * 1000;
              continue;
            }
            g.closing = { oldRoom: g.mode === "stage" ? stage(k) : team(k) };
            g.mode = "stage";
            g.epoch = crypto.randomUUID();
            g.handoff = 0;
          }
        }
        await changes();
        return reply({ ok: true });
      }
      // Complete due handoffs before returning any new room grants.
      const due = Object.entries(c.groups).filter(
        ([, g]) => g.mode === "stage" && g.handoff && g.handoff <= now,
      );
      for (const [k, g] of due) {
        if (available()) await closeRoom(stage(k));
        g.handoff = 0;
        const manager = pres.get(g.manager);
        if (manager && !manager.left && now - manager.at < 45000) {
          g.mode = "discussion";
          g.epoch = crypto.randomUUID();
        }
      }
      if (due.length) {
        try {
          await changes();
        } catch (error) {
          if (!(error instanceof VenueError && error.status === 409))
            throw error;
        }
        return null;
      }
      for (const l of live.filter(
        (l) => l.media_generation && l.planned_end_ms <= now,
      ))
        await close(l);
      if (a.action === "end") {
        need(active, 409, "没有进行中的会面");
        await close(active);
        return reply({ ok: true });
      }
      if (a.action === "admit" && s.format === "路演" && a.partner) {
        const other = person(a.partner),
          pair = [me, a.partner].sort().join(".");
        need(
          self && p && other && c.followups?.[pair]?.agreed,
          403,
          "请先取得双方同意",
        );
        const keyId = [a.id, 0, ...pair.split(".")].join("."),
          l = live.find((row) => row.id === keyId);
        need(!l?.media_closed_ms && available(), 409, "会后交流不可用");
        if (!l?.media_generation) {
          const media = await preparePair();
          try {
            await sql.batch([
              sql
                .prepare(
                  "INSERT OR IGNORE INTO venue_meetings VALUES(?,?,?,?,?,?,?,?,NULL,NULL)",
                )
                .bind(
                  keyId,
                  a.id,
                  keyId,
                  "follow/" + pair,
                  self.account,
                  other.account,
                  now,
                  now + c.duration * 60000,
                ),
              sql
                .prepare("INSERT INTO venue_admissions VALUES(?,?)")
                .bind(keyId, media),
            ]);
          } catch {
            await closeRoom(media);
            throw new VenueError(409, "双方需先离开其他会谈");
          }
        }
        await sql
          .prepare(
            "UPDATE her_entries SET data=json_set(data,'$.joined',?) WHERE id=? AND json_extract(data,'$.device')=?",
          )
          .bind(keyId, key + "/" + me, a.device)
          .run();
        return reply({ ok: true });
      }
      if (a.action === "admit") {
        need(
          meeting && p && current === meeting && p.skip !== mid(meeting),
          403,
          "这一轮不可进入",
        );
        const peer = pres.get(
          meeting.lead === me ? meeting.partner : meeting.lead,
        );
        need(
          peer &&
            !peer.left &&
            now - peer.at < 45000 &&
            peer.skip !== mid(meeting) &&
            !peer.skipped?.includes(mid(meeting)),
          409,
          "对方尚未准备入场",
        );
        need(
          c.groups[meeting.lead]?.mode === "discussion",
          409,
          "等待总主持人交棒",
        );
        need(now < end(meeting), 409, "本轮已截止");
        if (now < starts(meeting)) {
          need(
            p.early === mid(meeting) && peer.early === mid(meeting),
            409,
            "提前开始需要双方分别同意",
          );
          const intervening = s.meetings.some(
            (m) =>
              m.round < meeting.round &&
              (m.lead === meeting.lead || m.partner === meeting.partner) &&
              end(m) > now &&
              !live.find((l) => l.id === mid(m))?.media_closed_ms,
          );
          need(!intervening, 409, "已有约谈尚未结束");
        }
        need(available(), 503, "私聊媒体尚未配置");
        const id = mid(meeting),
          prior = live.find((l) => l.id === id);
        if (!prior?.media_generation) {
          need(!prior?.media_closed_ms, 409, "这场会面已结束");
          const media = await preparePair();
          try {
            await sql.batch([
              sql
                .prepare(
                  "INSERT OR IGNORE INTO venue_meetings VALUES(?,?,?,?,?,?,?,?,NULL,NULL)",
                )
                .bind(
                  id,
                  a.id,
                  id,
                  meeting.lead,
                  person(meeting.lead)!.account,
                  person(meeting.partner)!.account,
                  begin(a.round),
                  end(meeting),
                ),
              sql
                .prepare(
                  "INSERT INTO venue_admissions SELECT ?,? WHERE EXISTS(SELECT 1 FROM her_entries WHERE id=? AND json_extract(data,'$.rev')=?)",
                )
                .bind(id, media, key, currentRev),
            ]);
          } catch {
            await closeRoom(media);
            throw new VenueError(409, "上一场收尾中，请稍后重试");
          }
        }
        const held = await sql
          .prepare("SELECT meeting_id FROM venue_admissions WHERE meeting_id=?")
          .bind(id)
          .first();
        need(held, 409, "调度刚刚变化，请重新确认");
        await sql
          .prepare(
            "UPDATE her_entries SET data=json_set(data,'$.joined',?) WHERE id=? AND json_extract(data,'$.device')=?",
          )
          .bind(id, key + "/" + me, a.device)
          .run();
        return reply({ ok: true });
      }
      if (a.action === "media") {
        if (admin && a.group) {
          need(
            Object.hasOwn(c.groups, a.group) &&
              c.groups[a.group].mode === "stage",
            409,
            "该组已交棒",
          );
          return reply(
            await grant(
              stage(a.group),
              "presenter",
              name + " · 总主持人",
              true,
              false,
            ),
          );
        }
        if (
          active &&
          (p?.joined === active.id || p?.early === active.id || p?.automatic) &&
          active.planned_end_ms > now &&
          live.some((l) => l.id === active.id) &&
          (privateFollow ||
            c.groups[active.logical_room]?.mode === "discussion")
        ) {
          return reply(
            await grant(active.media_generation!, me, mediaName, true, true),
          );
        }
        need(group && c.groups[group], 409, "等待活动安排");
        if (c.groups[group].mode === "stage")
          return reply(
            await grant(
              stage(group),
              me,
              mediaName,
              s.format === "路演" && !!c.speakers?.includes(me),
              true,
            ),
          );
        need(
          !s.matching &&
            s.format === "创业快闪" &&
            self?.role !== "旁听" &&
            group !== "audience" &&
            group !== "lobby",
          409,
          "请从个人议程进入已获准的会面",
        );
        const ticket = await grant(team(group), me, mediaName, true, true);
        const latest = await readControl();
        const fresh = latest && (JSON.parse(latest.data) as Control);
        if (
          !fresh ||
          fresh.groups[group]?.epoch !== c.groups[group].epoch ||
          fresh.groups[group]?.closing
        ) {
          await closeRoom(ticket.room);
          throw new VenueError(409, "团队已调整，请重新进入");
        }
        return reply(ticket);
      }
      const state = (id: string, mId: string) => {
        const x = pres.get(id);
        if (!x) return "尚未签到";
        if (x.left) return "已离场";
        if (now - x.at > 45000) return "状态待确认";
        const l = live.find(
          (l) =>
            l.media_generation &&
            (l.host_account === person(id)?.account ||
              l.visitor_account === person(id)?.account),
        );
        if (l)
          return l.id !== mId
            ? "仍在上一场"
            : l.media_connected_ms
              ? "双方已连入"
              : "正在连接";
        return x.early === mId ? "已点击准备好" : "已签到";
      };
      const agenda = Array.from(
        {
          length:
            s.format === "导师答疑"
              ? Math.max(0, ...own.map((m) => m.round))
              : s.matching
                ? 6
                : 0,
        },
        (_, i) => {
          const r = i + 1,
            m = own.find((m) => m.round === r);
          const slot = {
            round: r,
            planned: begin(r),
            start: m ? starts(m) : begin(r),
            end: m ? end(m) : begin(r) + c.duration * 60000,
          };
          if (!m) return { ...slot, empty: true };
          const other = m.lead === me ? m.partner : m.lead,
            l = live.find((l) => l.id === mid(m));
          return {
            ...slot,
            id: mid(m),
            peer: other,
            name: label(other),
            verified: c.verified?.includes(other),
            topic: person(m.lead)?.topic,
            status: state(other, mid(m)),
            updated: pres.get(other)?.at,
            actual: l?.media_connected_ms,
            closed: l?.media_closed_ms,
            skipped: p?.skip === mid(m) || p?.skipped?.includes(mid(m)),
          };
        },
      );
      const signals = await sql
        .prepare(
          "SELECT id,state FROM her_entries WHERE kind='venue-signal' AND target=?",
        )
        .bind(a.id)
        .all<{ id: string; state: string }>();
      const rooms = Object.entries(c.groups)
        .filter(([, g]) => admin || dispatcher || g.manager === me)
        .map(([id, g]) => {
          const list = s.meetings.filter(
            (m) =>
              m.lead === id &&
              end(m) > now &&
              !live.find((l) => l.id === mid(m))?.media_closed_ms,
          );
          const m = list.sort((a, b) => a.round - b.round)[0],
            l = live.find((l) => l.logical_room === id && l.media_generation);
          const waited =
            m && !l && pres.get(id) && !pres.get(id)!.left
              ? Math.max(0, now - Math.max(starts(m), pres.get(id)!.entered))
              : 0;
          return {
            id,
            label:
              (flash && teamLabel(id)) ||
              label(id) ||
              (id === "auditorium" ? "路演舞台" : "") ||
              s.people.find((p) => p.group === id)?.topic ||
              "分组",
            signal:
              signals.results.find((r) => r.id === "signal/" + stage(id))
                ?.state || "待接收演示",
            managerOffline:
              !pres.has(g.manager) ||
              !!pres.get(g.manager)?.left ||
              now - pres.get(g.manager)!.at >= 45000,
            mode: g.mode,
            handoff: g.handoff,
            epoch: g.epoch,
            manager: person(g.manager)?.name || "总主持人",
            scheduledRound: m?.round,
            round: l ? Number(l.id.split(".")[1]) : 0,
            active: l
              ? [l.host_account, l.visitor_account]
                  .map(
                    (account) =>
                      s.people.find((p) => p.account === account)?.name,
                  )
                  .join("、")
              : "",
            next: (l ? list.find((q) => mid(q) !== l.id) : m)
              ? person((l ? list.find((q) => mid(q) !== l.id) : m)!.partner)
                  ?.name
              : "",
            waited,
            help: s.people
              .filter(
                (p) =>
                  (p.group === id || p.id === m?.partner) &&
                  pres.get(p.id)?.help,
              )
              .map((p) => ({
                id: p.id,
                text: p.name + " · " + pres.get(p.id)!.help,
              })),
          };
        });
      const followups = Object.values(c.followups || {})
        .filter((f) => f.from === me || f.to === me)
        .map((f) => {
          const peer = f.from === me ? f.to : f.from;
          return {
            peer,
            name: person(peer)?.name,
            received: f.to === me,
            choice: f.choice,
            agreed: f.agreed,
          };
        });
      return reply({
        rehearsalOf: s.rehearsalOf,
        latestRehearsal:
          !s.rehearsalOf && (!p || p.left || p.device !== a.device)
            ? (
                await sql
                  .prepare(
                    "SELECT id FROM her_entries WHERE kind='venue-rehearsal' AND target=? ORDER BY updated DESC LIMIT 1",
                  )
                  .bind(a.id)
                  .first<{ id: string }>()
              )?.id
            : undefined,
        verified: !!c.verified?.includes(me),
        followups,
        pitchContacts:
          s.format === "路演"
            ? (c.formerSpeakers || []).map((id) => ({
                id,
                name: person(id)?.name,
              }))
            : [],
        format: s.format,
        queueAhead: (c.queue || []).indexOf(me),
        onStage: (c.speakers || []).includes(me),
        queue: admin ? c.queue || [] : [],
        teamRoster:
          admin && flash
            ? s.people
                .filter((m) => m.role !== "旁听")
                .map((m) => ({
                  id: m.id,
                  name: label(m.id),
                  skills: m.skills || "",
                  tag: c.teamPlan?.[m.id]?.tag || "unset",
                  group: m.group,
                }))
            : undefined,
        teamName: flash
          ? teamLabel(group) ||
            s.people.find((m) => m.group === group)?.topic ||
            "团队"
          : undefined,
        title: s.title,
        name,
        me,
        role: self?.role || "总主持人",
        admin,
        matching: s.matching,
        checked: !!p && !p.left && p.device === a.device,
        now,
        revision: c.rev,
        notice: c.notice,
        wait: c.wait,
        automatic: p?.automatic,
        agenda,
        rooms,
        group,
        visits: Object.entries(c.visits || {})
          .filter(
            ([, v]) =>
              admin ||
              self?.group === v.group ||
              c.groups[v.group]?.manager === me,
          )
          .map(([id, v]) => ({ member: id, name: person(id)?.name, ...v })),
        visitOptions:
          s.format === "创业快闪" && self?.role !== "旁听"
            ? Object.keys(c.groups)
                .filter((k) => !["lobby", "audience", self?.group].includes(k))
                .map((id) => ({
                  id,
                  label: s.people.find((p) => p.group === id)?.topic || "团队",
                }))
            : [],
        mode: c.groups[group]?.mode,
        manager: person(c.groups[group]?.manager)?.name || "总主持人",
        handoff: c.groups[group]?.handoff,
        media: available(),
        mediaKey:
          flash && admin && !self
            ? null
            : (active &&
              (p?.joined === active.id ||
                p?.early === active.id ||
                p?.automatic)
                ? active.media_generation
                : null) ||
              (group && c.groups[group]
                ? c.groups[group].mode === "stage"
                  ? stage(group)
                  : !s.matching &&
                      s.format === "创业快闪" &&
                      self?.role !== "旁听" &&
                      group !== "audience" &&
                      group !== "lobby"
                    ? team(group)
                    : null
                : null),
        active:
          active &&
          (p?.joined === active.id || p?.early === active.id || p?.automatic)
            ? active.id
            : null,
        current: current?.round,
        dispatcher,
        dispatchers: admin ? c.dispatchers || [] : [],
        helpers: admin ? s.people.map((p) => ({ id: p.id, name: p.name })) : [],
      });
    }
    // Housekeeping may close a prior generation. Reload state and execute the
    // original command before acknowledging it to the participant.
    for (let attempt = 0; attempt < 4; attempt++) {
      const result = await dispatch();
      if (result) return result;
    }
    throw new VenueError(409, "会场刚有更新，请重试");
  } catch (e) {
    return reply(
      {
        error:
          e instanceof VenueError
            ? e.message
            : e instanceof z.ZodError
              ? "操作参数有误"
              : "会场服务暂不可用",
      },
      e instanceof VenueError ? e.status : e instanceof z.ZodError ? 400 : 503,
    );
  }
}
