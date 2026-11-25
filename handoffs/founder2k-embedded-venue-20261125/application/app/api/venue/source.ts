import { env } from "cloudflare:workers";
import type { Member, Meeting } from "../../women-matching";

export type Person = Pick<Member, "name" | "topic" | "id"> & {
  account: string;
  skills?: string;
  role: string;
  group: string;
};
export type Source = {
  title: string;
  start: number;
  people: Person[];
  meetings: Meeting[];
  matching: boolean;
  format: string;
  rehearsalOf?: string;
};
export class VenueError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireVenue(
  value: unknown,
  status: number,
  message: string,
): asserts value {
  if (!value) throw new VenueError(status, message);
}

export async function readSource(id: string): Promise<Source> {
  const run = await env
    .DB!.prepare(
      "SELECT target,updated FROM her_entries WHERE kind='venue-rehearsal' AND id=?",
    )
    .bind(id)
    .first<{ target: string; updated: number }>();
  const source = await readActivity(run?.target || id);
  return run
    ? {
        ...source,
        title: source.title + " · 彩排",
        start: run.updated,
        rehearsalOf: run.target,
      }
    : source;
}

async function readActivity(id: string): Promise<Source> {
  const db = env.DB!;
  const program = await db
    .prepare("SELECT data FROM her_entries WHERE kind='women-program' AND id=?")
    .bind(id)
    .first<{ data: string }>();
  if (program) {
    const session = JSON.parse(program.data) as {
      published: boolean;
      title: string;
      start: string;
      members: (Member & { account: string })[];
      meetings: Meeting[];
    };
    requireVenue(session.published, 409, "请先发布本场排班");
    return {
      title: session.title,
      start: Date.parse(session.start),
      matching: true,
      format: "女性共创",
      meetings: session.meetings,
      people: session.members.map(({ id, account, name, role, topic }) => ({
        id,
        account,
        name,
        role,
        topic,
        group:
          role === "项目发起人"
            ? id
            : session.meetings.find((m) => m.partner === id)?.lead || "",
      })),
    };
  }
  const cohort = await db
    .prepare(
      "SELECT payload FROM platform_items WHERE kind='cohort' AND id=? AND status IN ('open','closed')",
    )
    .bind(id)
    .first<{ payload: string }>();
  requireVenue(cohort, 404, "找不到这场活动");
  const c = JSON.parse(cohort.payload);
  const { results } = await db
    .prepare(
      `SELECT a.id,a.owner,a.payload,(SELECT t.id FROM platform_items t WHERE t.kind='team' AND t.parent=a.parent
    AND (t.owner=a.owner OR EXISTS (SELECT 1 FROM platform_items i WHERE i.kind='invite' AND i.status='accepted' AND i.parent=t.id AND i.owner=a.owner)) ORDER BY t.id LIMIT 1) AS team
    FROM platform_items a WHERE a.kind='application' AND a.status='admitted' AND a.parent=?`,
    )
    .bind(id)
    .all<{ id: string; owner: string; payload: string; team: string | null }>();
  return {
    title: c.title,
    start: Date.parse(c.start),
    matching: c.venueFormat === "导师答疑",
    format: c.venueFormat || "创业快闪",
    meetings: [],
    people: results.map((r) => {
      const p = JSON.parse(r.payload);
      return {
        id: r.id,
        account: r.owner,
        name: p.name,
        role: p.role,
        topic: p.goal,
        skills: p.skills || "",
        group:
          c.venueFormat === "路演"
            ? "auditorium"
            : c.venueFormat === "导师答疑"
              ? ""
              : p.role === "旁听"
                ? "audience"
                : r.team || "lobby",
      };
    }),
  };
}
