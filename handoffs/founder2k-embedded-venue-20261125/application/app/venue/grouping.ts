export const roleTags = ["unset", "idea", "open", "builder", "seller"] as const;
export type RoleTag = (typeof roleTags)[number];
export const tagNames: Record<RoleTag, string> = {
  unset: "待标注",
  idea: "有 idea",
  open: "无 idea · 方向待定",
  builder: "Builder · 产品开发",
  seller: "Seller · 销售",
};
export type GroupMember = {
  id: string;
  name: string;
  tag: RoleTag;
  group: string;
  skills: string;
};
export type GroupMode = "balanced" | "random" | "alphabetical";
export const ideaRoom = (id: string) => "idea/" + id;
const names = new Intl.Collator("zh-CN-u-co-pinyin", {
  sensitivity: "base",
  numeric: true,
});
function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
// Each selected idea owner anchors a team. Existing members outside the selection
// contribute to the counts and retain their assignments.
export function distribute(
  members: GroupMember[],
  selected: Set<string>,
  mode: GroupMode,
): GroupMember[] {
  const sorted = [...members].sort(
    (a, b) => names.compare(a.name, b.name) || a.id.localeCompare(b.id),
  );
  const anchors = sorted.filter(
    (m) =>
      m.tag === "idea" && (selected.has(m.id) || m.group === ideaRoom(m.id)),
  );
  if (!anchors.length) throw Error("请先选择有 idea 的成员创建团队。");
  const teams = mode === "random" ? shuffled(anchors) : anchors;
  const counts = teams.map(() => ({
    total: 0,
    unset: 0,
    idea: 0,
    open: 0,
    builder: 0,
    seller: 0,
  }));
  const positions = new Map(teams.map((m, i) => [ideaRoom(m.id), i]));
  const assigned = new Map<string, string>();
  for (const m of members) {
    const group =
      m.tag === "idea" && selected.has(m.id) ? ideaRoom(m.id) : m.group;
    if (m.tag === "idea" || !selected.has(m.id)) {
      assigned.set(m.id, group);
      const i = positions.get(group);
      if (i !== undefined) {
        counts[i][m.tag]++;
        counts[i].total++;
      }
    }
  }
  const movable = sorted.filter(
    (m) => selected.has(m.id) && !assigned.has(m.id),
  );
  const queue =
    mode === "random"
      ? shuffled(movable)
      : mode === "alphabetical"
        ? movable
        : members.filter((m) => selected.has(m.id) && !assigned.has(m.id));
  for (const m of queue) {
    // Balance the scarcest role within the selection before total team size.
    const best = counts.reduce(
      (best, c, i) =>
        c[m.tag] < counts[best][m.tag] ||
        (c[m.tag] === counts[best][m.tag] && c.total < counts[best].total)
          ? i
          : best,
      0,
    );
    counts[best][m.tag]++;
    counts[best].total++;
    assigned.set(m.id, ideaRoom(teams[best].id));
  }
  return members.map((m) => ({ ...m, group: assigned.get(m.id) || m.group }));
}
