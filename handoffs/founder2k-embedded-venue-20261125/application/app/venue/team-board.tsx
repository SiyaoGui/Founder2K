"use client";
import { useState } from "react";
import {
  distribute,
  ideaRoom,
  roleTags,
  tagNames,
  type GroupMember,
  type GroupMode,
  type RoleTag,
} from "./grouping";

type Props = {
  members: GroupMember[];
  rooms: { id: string; label: string }[];
  revision: number;
  publish: (plan: GroupMember[], revision: number) => Promise<void>;
};
export default function TeamBoard({
  members,
  rooms,
  revision,
  publish,
}: Props) {
  const [draft, setDraft] = useState<GroupMember[] | null>(null);
  const [version, setVersion] = useState(revision);
  const [selection, select] = useState<string[]>([]);
  const [tag, setTag] = useState<RoleTag>("idea");
  const [mode, setMode] = useState<GroupMode>("balanced");
  const [destination, setDestination] = useState("lobby");
  const [error, setError] = useState("");
  const [saving, save] = useState(false);
  const rows = draft || members,
    selected = new Set(selection);
  const groups = new Map([["lobby", "主会场"]]);
  for (const room of rooms)
    if (room.id !== "audience" && !room.id.startsWith("idea/"))
      groups.set(room.id, room.label);
  for (const m of rows)
    if (m.group === ideaRoom(m.id)) groups.set(m.group, m.name + "的团队");
  const changes = rows.filter((m) => {
    const old = members.find((p) => p.id === m.id);
    return old && (old.tag !== m.tag || old.group !== m.group);
  });
  function edit(next: GroupMember[]) {
    if (!draft) setVersion(revision);
    setError("");
    setDraft(next);
  }
  function move(ids: Set<string>, to: string) {
    if (!groups.has(to)) return;
    if (
      rows.some(
        (m) =>
          ids.has(m.id) &&
          m.tag === "idea" &&
          m.group === ideaRoom(m.id) &&
          m.group !== to,
      )
    ) {
      setError("要解散创意组，请先修改发起人的标签。");
      return;
    }
    if (
      to.startsWith("idea/") &&
      rows.some(
        (m) => ids.has(m.id) && m.tag === "idea" && ideaRoom(m.id) !== to,
      )
    ) {
      setError("每位有 idea 的成员应主持自己的团队。");
      return;
    }
    edit(rows.map((m) => (ids.has(m.id) ? { ...m, group: to } : m)));
  }
  function mark() {
    const removed = new Set(
      rows
        .filter(
          (m) =>
            selected.has(m.id) && m.group === ideaRoom(m.id) && tag !== "idea",
        )
        .map((m) => m.group),
    );
    edit(
      rows.map((m) => ({
        ...m,
        tag: selected.has(m.id) ? tag : m.tag,
        group: removed.has(m.group) ? "lobby" : m.group,
      })),
    );
  }
  return (
    <section className="venue-board" aria-label="快闪团队编组">
      <h3>快闪团队编组</h3>
      <p>
        先给每位有 idea
        的成员建组，再按角色分配伙伴。确认发布后，成员从自己的会场进入对应团队。
      </p>
      <div className="venue-actions">
        {(
          [
            ["全部成员", () => true],
            ["有 idea", (m: GroupMember) => m.tag === "idea"],
            [
              "无 idea",
              (m: GroupMember) => ["open", "builder", "seller"].includes(m.tag),
            ],
            ["Builder", (m: GroupMember) => m.tag === "builder"],
            ["Seller", (m: GroupMember) => m.tag === "seller"],
          ] as const
        ).map(([name, filter]) => (
          <button
            key={name}
            onClick={() => select(rows.filter(filter).map((m) => m.id))}
          >
            {name === "全部成员" ? "全选所有成员" : "全选" + name}
          </button>
        ))}
        <button onClick={() => select([])}>清除选择</button>
      </div>
      <div className="venue-actions">
        <label>
          批量标注
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value as RoleTag)}
          >
            {roleTags.map((t) => (
              <option key={t} value={t}>
                {tagNames[t]}
              </option>
            ))}
          </select>
        </label>
        <button disabled={!selected.size} onClick={mark}>
          应用标签
        </button>
        <label>
          分发方式
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as GroupMode)}
          >
            <option value="balanced">角色均衡</option>
            <option value="random">随机分发</option>
            <option value="alphabetical">姓名 A–Z（中文按拼音）</option>
          </select>
        </label>
        <button
          disabled={!selected.size}
          onClick={() => {
            try {
              edit(distribute(rows, selected, mode));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          分发所选 {selected.size} 人
        </button>
        <label>
          手动移入
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            {[...groups].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!selected.size}
          onClick={() => move(selected, destination)}
        >
          移动所选成员
        </button>
      </div>
      <div className="venue-team-grid">
        {[...groups].map(([id, name]) => {
          const team = rows.filter((m) => m.group === id);
          return (
            <section
              key={id}
              aria-label={name}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const key = e.dataTransfer.getData("text/venue-member");
                if (rows.some((m) => m.id === key)) move(new Set([key]), id);
              }}
            >
              <h4>{name}</h4>
              <small>
                {team.length} 人 · Builder{" "}
                {team.filter((m) => m.tag === "builder").length} · Seller{" "}
                {team.filter((m) => m.tag === "seller").length}
              </small>
              {team.map((m) => (
                <label
                  key={m.id}
                  draggable
                  title={m.skills || m.name}
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/venue-member", m.id)
                  }
                >
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={(e) =>
                      select(
                        e.target.checked
                          ? [...selection, m.id]
                          : selection.filter((k) => k !== m.id),
                      )
                    }
                  />
                  {m.name} <span>{tagNames[m.tag]}</span>
                </label>
              ))}
            </section>
          );
        })}
      </div>
      {draft && (
        <div className="venue-alert">
          <strong>待发布 · {changes.length} 位成员有变动</strong>
          <p>
            {changes
              .map(
                (m) =>
                  m.name +
                  " → " +
                  (groups.get(m.group) || "主会场") +
                  "（" +
                  tagNames[m.tag] +
                  "）",
              )
              .join("、")}
          </p>
          <p>已在讨论的成员调离时，原组会短暂重连。其他讨论组继续。</p>
          {version !== revision && <p>现场安排已更新，请重新载入后编组。</p>}
          <button
            disabled={saving || !changes.length || version !== revision}
            onClick={async () => {
              save(true);
              try {
                await publish(changes, version);
                setDraft(null);
                select([]);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                save(false);
              }
            }}
          >
            确认发布分组
          </button>
          <button
            disabled={saving}
            onClick={() => {
              setDraft(null);
              select([]);
              setError("");
            }}
          >
            放弃草稿并载入现场
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
