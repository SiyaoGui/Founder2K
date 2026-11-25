"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaPanel, Presenter } from "./media-panel";
import "./venue.css";
import TeamBoard from "./team-board";
import { roleTags, tagNames, type RoleTag, type GroupMember } from "./grouping";
import DeviceCheck from "./device-check";

type Slot = {
  peer?: string;
  verified?: boolean;
  planned: number;
  round: number;
  start: number;
  end: number;
  name?: string;
  topic?: string;
  status?: string;
  updated?: number;
  empty?: boolean;
  closed?: number;
  actual?: number;
  skipped?: boolean;
  id?: string;
};
type Group = {
  signal: string;
  managerOffline: boolean;
  round: number;
  id: string;
  label: string;
  epoch: string;
  mode: string;
  manager: string;
  handoff: number;
  active: string;
  next: string;
  waited: number;
  scheduledRound?: number;
  help: { id: string; text: string }[];
};
type View = {
  teamName?: string;
  teamRoster?: GroupMember[];
  rehearsalOf?: string;
  latestRehearsal?: string;
  verified: boolean;
  pitchContacts: { id: string; name: string }[];
  followups: {
    peer: string;
    name: string;
    received: boolean;
    choice: string;
    agreed: boolean;
  }[];
  visits: { member: string; group: string; name: string; approved: boolean }[];
  visitOptions: { id: string; label: string }[];
  format: string;
  onStage: boolean;
  queueAhead: number;
  queue: string[];
  title: string;
  name: string;
  admin: boolean;
  me: string;
  role: string;
  matching: boolean;
  checked: boolean;
  now: number;
  notice: string;
  revision: number;
  wait: number;
  automatic: boolean;
  agenda: Slot[];
  rooms: Group[];
  group: string;
  mode: string;
  manager: string;
  handoff: number;
  media: boolean;
  mediaKey: string | null;
  active?: string;
  current?: number;
  dispatcher: boolean;
  dispatchers: string[];
  helpers: { id: string; name: string }[];
};
const time = (ms: number) =>
  new Date(ms).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
function remaining(ms: number) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(sec / 60) + " 分 " + (sec % 60) + " 秒";
}
export default function Venue() {
  const [v, setV] = useState<View | null>(null),
    [notice, setNotice] = useState(""),
    [opened, expand] = useState(true),
    [now, clock] = useState(0),
    [busy, setBusy] = useState(false);
  const previewRevision = useRef(-1);
  const [teamTag, setTeamTag] = useState<RoleTag>("unset");
  const [name, setName] = useState(""),
    [automatic, setAutomatic] = useState(false),
    [scope, setScope] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [sub, setSub] = useState("host"),
    [guest, setGuest] = useState(""),
    [round, setRound] = useState(1),
    [preview, setPreview] = useState("");
  const device = useRef(""),
    event = useRef(""),
    delta = useRef(0),
    pulse = useRef(0),
    state = useRef<View | null>(null),
    attempt = useRef("");
  const request = useCallback(
    async <T = unknown,>(
      action: string,
      data: Record<string, unknown> = {},
    ) => {
      const res = await fetch("/api/venue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id: event.current,
          device: device.current,
          ...data,
        }),
        cache: "no-store",
      });
      const result = (await res.json()) as { error?: string };
      if (!res.ok) throw Error(result.error || "会场暂不可用");
      return result as T;
    },
    [],
  );
  const refresh = useCallback(async () => {
    const result = await request<View & { retry?: boolean }>("view");
    if (result.retry) return;
    delta.current = result.now - Date.now();
    clock(result.now);
    setV(result);
    state.current = result;
  }, [request]);
  useEffect(() => {
    event.current = new URLSearchParams(location.search).get("id") || "";
    device.current =
      sessionStorage.getItem("venue-device") || crypto.randomUUID();
    sessionStorage.setItem("venue-device", device.current);
    expand(!matchMedia("(max-width:700px)").matches);
    let running = false,
      live = true;
    async function poll() {
      if (running || !live) return;
      running = true;
      try {
        if (state.current?.checked && Date.now() - pulse.current > 12000) {
          pulse.current = Date.now();
          try {
            await request("pulse");
          } finally {
            await refresh();
          }
        }
        await refresh();
      } catch (e) {
        if (live) setNotice(e instanceof Error ? e.message : "连接失败");
      } finally {
        running = false;
      }
    }
    void poll();
    const task = setInterval(poll, 2500),
      timer = setInterval(() => clock(Date.now() + delta.current), 500);
    return () => {
      live = false;
      clearInterval(task);
      clearInterval(timer);
    };
  }, [refresh, request]);
  async function action(type: string, data: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await request<{ rehearsalId?: string }>(type, {
        revision: v?.revision,
        ...data,
      });
      if (type === "rehearse" && response.rehearsalId) {
        location.assign(
          "/venue?id=" + encodeURIComponent(response.rehearsalId),
        );
        return;
      }
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }
  const current = v?.agenda.find((s) => s.round === v.current),
    next = v?.agenda.find(
      (s) =>
        !s.empty && !s.skipped && !s.closed && s.round > (current?.round ?? 0),
    );
  useEffect(() => {
    if (
      !v?.checked ||
      !v.automatic ||
      v.active ||
      v.mode !== "discussion" ||
      !current ||
      now < current.start ||
      now >= current.end ||
      !["已签到", "已点击准备好"].includes(current.status || "")
    )
      return;
    const key = current.id + "-" + Math.floor(now / 10000);
    if (attempt.current === key) return;
    attempt.current = key;
    void action("admit", { round: current.round });
  }, [v, now]);
  const pending =
    preview === "recall"
      ? v?.rooms || []
      : v?.rooms.filter((g) => scope.includes(g.id)) || [];
  return (
    <main className="venue-shell">
      <header>
        <a
          href={
            v?.format === "女性共创"
              ? "/#women/program?id=" + (v.rehearsalOf || event.current)
              : "/#cohorts?id=" + (v?.rehearsalOf || event.current)
          }
        >
          ‹ 返回活动
        </a>
        <span>Founder2K</span>
      </header>
      <h1>{v?.title || "活动会场"}</h1>
      {v?.admin && !v.rehearsalOf && (
        <button disabled={busy} onClick={() => void action("rehearse")}>
          创建独立彩排场次
        </button>
      )}
      {v?.latestRehearsal && (
        <a href={"/venue?id=" + encodeURIComponent(v.latestRehearsal)}>
          进入本场最近一次彩排
        </a>
      )}
      {v?.rehearsalOf && (
        <p>
          彩排场次 ·
          分享当前会场地址给本活动已报名成员。签到、会面和主持操作仅保存在本次彩排。
        </p>
      )}
      {notice && (
        <p role="alert" className="venue-alert">
          {notice}
        </p>
      )}
      {v && !v.checked && (
        <form
          className="venue-check"
          onSubmit={(e) => {
            e.preventDefault();
            void action("check", { text: name, automatic, teamTag });
          }}
        >
          <h2>签到进入会场</h2>
          <DeviceCheck />
          <p>
            {v.role} · 报名姓名 {v.name} · 本人声明
          </p>
          <label>
            确认报名姓名
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={automatic}
              onChange={(e) => setAutomatic(e.target.checked)}
            />{" "}
            正常换轮时自动转场
          </label>
          {v.format === "创业快闪" && v.role === "参与者" && (
            <label>
              本场组队角色
              <select
                value={teamTag}
                onChange={(e) => setTeamTag(e.target.value as RoleTag)}
              >
                {roleTags.map((t) => (
                  <option key={t} value={t}>
                    {tagNames[t]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button disabled={busy}>签到</button>
        </form>
      )}
      {v?.checked && (
        <>
          <p>
            {v.name} · {v.role} · {v.verified ? "已核验" : "本人声明"}{" "}
            <button onClick={() => action("leave")}>离开会场</button>
          </p>
          {v.notice && (
            <p className="venue-alert" role="status">
              全场通知 · {v.notice}
            </p>
          )}
          <div className="venue-layout">
            <section className="venue-stage">
              <small>
                当前主持 · {v.mode === "stage" ? "总主持人" : v.manager}
              </small>
              <h2>
                {v.mode === "stage"
                  ? "开场演示"
                  : v.active
                    ? "与" + (current?.name || "伙伴") + "会谈"
                    : v.matching
                      ? "个人候场区"
                      : "团队活动"}
              </h2>
              {v.handoff > now && (
                <p>交棒倒计时 · {remaining(v.handoff - now)}</p>
              )}
              {v.format === "路演" && (
                <p>
                  {v.onStage
                    ? "已获准上台发言"
                    : v.queueAhead >= 0
                      ? "候场中 · 前面还有 " + v.queueAhead + " 位"
                      : "观众席"}
                </p>
              )}
              {v.teamName && <p>当前分配 · {v.teamName}</p>}
              <MediaPanel
                channel={
                  v.mediaKey ? v.mediaKey + (v.onStage ? "/speaker" : "") : null
                }
                enabled={v.media}
                ticket={() =>
                  request<{ url: string; token: string; publish: boolean }>(
                    "media",
                  )
                }
              />
              {!v.media && <p>媒体服务尚未连接。仍可查看议程或私下求助。</p>}
              {current && (
                <>
                  <h3>
                    与{current.name}讨论{current.topic}
                  </h3>
                  <p>
                    {current.status} ·{" "}
                    {current.start > now
                      ? "距计划开始 " + remaining(current.start - now)
                      : "距计划结束 " + remaining(current.end - now)}
                  </p>
                  {current.updated && (
                    <small>对方状态更新于 {time(current.updated)}</small>
                  )}
                  {v.active ? (
                    <button onClick={() => action("end")}>结束本次会谈</button>
                  ) : (
                    <div className="venue-actions">
                      <button
                        disabled={
                          busy ||
                          (now < current.start &&
                            current.status !== "已点击准备好")
                        }
                        onClick={() =>
                          action("admit", { round: current.round })
                        }
                      >
                        进入本次会谈
                      </button>
                      {now < current.start && (
                        <button
                          onClick={() =>
                            action("ready", { round: current.round })
                          }
                        >
                          可以提前开始
                        </button>
                      )}
                      <button
                        onClick={() => action("skip", { round: current.round })}
                      >
                        跳过本轮
                      </button>
                    </div>
                  )}
                  {v.active && current.end - now <= 60000 && (
                    <p role="status">
                      {current.end - now <= 10000
                        ? "最后十秒"
                        : "本轮还剩不到一分钟"}
                    </p>
                  )}
                  {!v.active && now - current.start >= v.wait * 1000 && (
                    <p role="status">
                      已等候 {remaining(now - current.start)} ·
                      可继续等或登记补谈
                    </p>
                  )}
                </>
              )}
              <div className="venue-actions">
                <button
                  onClick={() => action("help", { text: "需要主持人协助" })}
                >
                  私下求助
                </button>
                <button onClick={() => action("help", { text: "申请补谈" })}>
                  登记补谈
                </button>
              </div>
            </section>
            <aside className="venue-agenda">
              <button aria-expanded={opened} onClick={() => expand(!opened)}>
                {opened ? "收起" : "展开"}个人议程
              </button>
              <strong>
                现在 ·{" "}
                {v.mode === "stage"
                  ? "观看演示"
                  : current?.name || "查看本场安排"}
              </strong>
              <p>
                下一位 ·{" "}
                {next ? next.name + " · " + time(next.start) : "暂无后续预约"}
              </p>
              {current && (
                <small>
                  {current.start > now ? "距计划开始 " : "距计划结束 "}
                  {remaining(
                    (current.start > now ? current.start : current.end) - now,
                  )}
                </small>
              )}
              {opened && (
                <ol>
                  {v.agenda.map((s) => (
                    <li key={s.round}>
                      <b>
                        第 {s.round} 场 · {s.empty ? "空档" : s.name}
                      </b>
                      <small>
                        原计划 {time(s.planned)}
                        {s.start !== s.planned
                          ? " · 调整至 " + time(s.start)
                          : ""}{" "}
                        · 截止 {time(s.end)}
                      </small>
                      {!s.empty && (
                        <>
                          {s.closed && s.actual && (
                            <button
                              onClick={() =>
                                action("follow", {
                                  partner: s.peer,
                                  text: "试合作",
                                })
                              }
                            >
                              邀请试合作
                            </button>
                          )}
                          {s.closed && s.actual && (
                            <button
                              onClick={() =>
                                action("follow", {
                                  partner: s.peer,
                                  text: "补谈",
                                })
                              }
                            >
                              邀请补谈
                            </button>
                          )}
                          <span>
                            {s.closed
                              ? "已结束"
                              : s.skipped
                                ? "已跳过"
                                : s.status}
                          </span>
                          {s.updated && (
                            <small>状态更新 {time(s.updated)}</small>
                          )}
                          {s.actual && (
                            <small>
                              实际连通 {time(s.actual)}
                              {s.closed ? " 至 " + time(s.closed) : ""}
                            </small>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </aside>
          </div>
          {v.visitOptions.length > 0 && (
            <details>
              <summary>申请导师巡组</summary>
              {v.visitOptions.map((g) => (
                <button
                  key={g.id}
                  onClick={() => action("visit", { group: g.id })}
                >
                  申请加入{g.label}
                </button>
              ))}
            </details>
          )}
          {v.pitchContacts.map((t) => (
            <button
              key={t.id}
              onClick={() => action("follow", { partner: t.id, text: "补谈" })}
            >
              邀请{t.name}会后交流
            </button>
          ))}
          {v.followups.map((f) => (
            <article key={f.peer}>
              {f.name} · {f.choice} ·{" "}
              {f.agreed
                ? "双方已同意"
                : f.received
                  ? "对方邀请你"
                  : "等待对方回应"}
              {f.received && !f.agreed && (
                <>
                  <button
                    onClick={() =>
                      action("respondFollow", { partner: f.peer, text: "同意" })
                    }
                  >
                    同意
                  </button>
                  <button
                    onClick={() =>
                      action("respondFollow", { partner: f.peer, text: "婉拒" })
                    }
                  >
                    婉拒
                  </button>
                </>
              )}
              {f.agreed && v.format === "路演" && (
                <button onClick={() => action("admit", { partner: f.peer })}>
                  与{f.name}私下交流
                </button>
              )}
            </article>
          ))}
          {v.active && !current && (
            <button onClick={() => action("end")}>结束私下交流</button>
          )}
          {v.visits.map((t) => (
            <p key={t.member}>
              {t.name} · {t.approved ? "已获准巡组" : "申请巡组"}{" "}
              {!t.approved && (
                <button
                  onClick={() =>
                    action("acceptVisit", { group: t.group, text: t.member })
                  }
                >
                  允许加入
                </button>
              )}
            </p>
          ))}
          {(v.rooms.length > 0 || v.admin) && (
            <section className="venue-console">
              <h2>{v.admin ? "总主持人调度台" : "分组管理员面板"}</h2>
              <p role="status">
                {v.rooms.filter((g) => g.waited >= v.wait * 1000).length}{" "}
                组等待超时 · {v.rooms.filter((g) => g.help.length).length}{" "}
                组请求协助 ·{" "}
                {
                  v.rooms.filter(
                    (g) => g.mode === "stage" && g.signal === "演示信号待确认",
                  ).length
                }{" "}
                组演示信号待确认 ·{" "}
                {v.rooms.filter((g) => g.mode === "stage").length} 组演示中
              </p>
              {v.admin && v.teamRoster && (
                <TeamBoard
                  members={v.teamRoster}
                  rooms={v.rooms}
                  revision={v.revision}
                  publish={async (plan, revision) => {
                    await request("teamPlan", {
                      revision,
                      plan: plan.map(({ id, tag, group }) => ({
                        id,
                        tag,
                        group,
                      })),
                    });
                    await refresh();
                  }}
                />
              )}
              {v.rooms
                .slice()
                .sort(
                  (a, b) =>
                    b.help.length - a.help.length || b.waited - a.waited,
                )
                .map((g) => (
                  <article key={g.id}>
                    <label>
                      {v.admin && (
                        <input
                          type="checkbox"
                          checked={scope.includes(g.id)}
                          onChange={(e) =>
                            setScope((v) =>
                              e.target.checked
                                ? [...v, g.id]
                                : v.filter((id) => id !== g.id),
                            )
                          }
                        />
                      )}{" "}
                      {g.label}
                    </label>
                    <p>
                      {g.mode === "stage"
                        ? "演示中 · 总主持人"
                        : "已交棒 · " + g.manager}{" "}
                      {g.mode === "stage" && " · " + g.signal}
                      {g.managerOffline && " · 接班人离线"} ｜ 当前{" "}
                      {g.active || "等候"} ｜ 下一位 {g.next || "暂无"}{" "}
                      {g.waited > 0 && " · 等候 " + remaining(g.waited)}
                    </p>
                    {v.admin && g.active && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "将延长 " +
                                g.active +
                                " 的会谈一分钟；后续有冲突时将取消。",
                            )
                          )
                            void action("extend", {
                              group: g.id,
                              round: g.round,
                            });
                        }}
                      >
                        延长一分钟
                      </button>
                    )}
                    {g.help.map((h) => (
                      <p key={h.id}>
                        {h.text}{" "}
                        <button
                          onClick={() =>
                            action("resolve", { group: g.id, text: h.id })
                          }
                        >
                          已处理
                        </button>
                      </p>
                    ))}
                    <button
                      onClick={() =>
                        action("requestSlot", {
                          group: g.id,
                          text: g.next || "待安排",
                        })
                      }
                    >
                      申请补位
                    </button>
                    {(v.admin || v.dispatcher) &&
                      g.scheduledRound &&
                      !g.active && (
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "将 " +
                                  g.label +
                                  " 与 " +
                                  g.next +
                                  " 的会面推迟一分钟？",
                              )
                            )
                              void action("shift", {
                                group: g.id,
                                round: g.scheduledRound,
                                delay: 60,
                              });
                          }}
                        >
                          调整下一场
                        </button>
                      )}
                  </article>
                ))}
              {v.admin && (
                <>
                  <Presenter
                    targets={v.rooms
                      .filter((g) => g.mode === "stage")
                      .map((g) => ({ id: g.id, epoch: g.epoch }))}
                    ticket={(id) =>
                      request<{ url: string; token: string; publish: boolean }>(
                        "media",
                        { group: id },
                      )
                    }
                  />
                  <label>
                    分组主持或预约导师
                    <select
                      value={sub}
                      onChange={(e) => setSub(e.target.value)}
                    >
                      <option value="host">总主持暂代</option>
                      {v.helpers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={sub === "host"}
                    onClick={() => {
                      if (confirm("已完成该成员的身份核验？"))
                        void action("verify", { text: sub });
                    }}
                  >
                    标记姓名已核验
                  </button>
                  <button
                    disabled={sub === "host"}
                    onClick={() => {
                      const enabled = !v.dispatchers.includes(sub);
                      if (
                        confirm(
                          enabled
                            ? "允许这位成员查看本场房间调度表并调整预约？"
                            : "撤销本场调度权限？",
                        )
                      )
                        void action("dispatchRole", {
                          text: sub,
                          automatic: enabled,
                        });
                    }}
                  >
                    {v.dispatchers.includes(sub)
                      ? "撤销本场调度权限"
                      : "授权本场调度员"}
                  </button>
                  {v.format === "导师答疑" && (
                    <fieldset>
                      <legend>安排导师预约</legend>
                      <label>
                        来访者
                        <select
                          value={guest}
                          onChange={(e) => setGuest(e.target.value)}
                        >
                          <option value="">请选择</option>
                          {v.helpers.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        时段序号
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={round}
                          onChange={(e) => setRound(Number(e.target.value))}
                        />
                      </label>
                      <button
                        onClick={() =>
                          action("book", { group: sub, partner: guest, round })
                        }
                      >
                        预约所选导师
                      </button>
                    </fieldset>
                  )}
                  {v.format === "路演" && (
                    <>
                      <button onClick={() => action("offstage", { text: sub })}>
                        结束所选成员展示
                      </button>
                      <button onClick={() => action("lineup", { text: sub })}>
                        加入候场队列
                      </button>
                      <button
                        disabled={!v.queue.length}
                        onClick={() => action("call", { text: v.queue[0] })}
                      >
                        邀请下一位上台
                      </button>
                    </>
                  )}
                  <div className="venue-actions">
                    {v.teamRoster && (
                      <button
                        disabled={
                          busy ||
                          !v.rooms.some(
                            (g) =>
                              g.id.startsWith("idea/") && g.mode === "stage",
                          )
                        }
                        onClick={() => {
                          setScope(
                            v.rooms
                              .filter(
                                (g) =>
                                  g.id.startsWith("idea/") &&
                                  g.mode === "stage",
                              )
                              .map((g) => g.id),
                          );
                          previewRevision.current = v.revision;
                          setPreview("handoff");
                        }}
                      >
                        开始所有创意组讨论
                      </button>
                    )}
                    {[
                      ["handoff", "现在交棒"],
                      ["countdown", "30 秒后交棒"],
                      ["delegate", "指定替补"],
                      ["restore", "恢复向指定组分发演示"],
                      ["recall", "结束分组并召回全场"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        disabled={busy || (key !== "recall" && !scope.length)}
                        onClick={() => {
                          previewRevision.current = v.revision;
                          setPreview(key);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {preview && (
                    <div className="venue-alert">
                      <p>
                        影响范围 ·{" "}
                        {pending
                          .map(
                            (g) =>
                              g.label +
                              (g.active ? "（" + g.active + "）" : ""),
                          )
                          .join("、")}
                      </p>
                      <button
                        onClick={() => {
                          void action(
                            preview === "countdown" ? "handoff" : preview,
                            {
                              revision: previewRevision.current,
                              groups: scope,
                              delay: preview === "countdown" ? 30 : 0,
                              text: sub,
                            },
                          );
                          setPreview("");
                        }}
                      >
                        确认操作
                      </button>
                      <button onClick={() => setPreview("")}>取消</button>
                    </div>
                  )}
                  <details>
                    <summary>轮转与超时设置</summary>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const d = new FormData(e.currentTarget);
                        void action("settings", {
                          duration: Number(d.get("duration")),
                          gap: Number(d.get("gap")),
                          wait: Number(d.get("wait")),
                        });
                      }}
                    >
                      <label>
                        每轮分钟
                        <input
                          name="duration"
                          type="number"
                          defaultValue={15}
                          min={1}
                          max={180}
                        />
                      </label>
                      <label>
                        间隔分钟
                        <input
                          name="gap"
                          type="number"
                          defaultValue={2}
                          min={0}
                          max={60}
                        />
                      </label>
                      <label>
                        等待告警秒数
                        <input
                          name="wait"
                          type="number"
                          defaultValue={v.wait}
                          min={10}
                          max={1800}
                        />
                      </label>
                      <button>保存</button>
                    </form>
                  </details>
                  <label>
                    全场文字通知
                    <input
                      maxLength={400}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={!message.trim()}
                    onClick={() => action("notify", { text: message })}
                  >
                    发一条全场通知
                  </button>
                </>
              )}
            </section>
          )}
          <a
            href={
              v.rehearsalOf
                ? "/venue?id=" + encodeURIComponent(v.rehearsalOf)
                : v.format === "女性共创"
                  ? "/#women/program?id=" + event.current
                  : "/#teamspace"
            }
          >
            {v.rehearsalOf ? "返回正式活动会场" : "会后邀请与团队工作台"}
          </a>
        </>
      )}
    </main>
  );
}
