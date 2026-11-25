import { env } from "cloudflare:workers";
import { closeRoom } from "../media";
export async function POST(req: Request) {
  const secret = (env as unknown as { VENUE_CLOCK_KEY?: string })
    .VENUE_CLOCK_KEY;
  if (!secret || req.headers.get("Authorization") !== "Bearer " + secret)
    return new Response(null, { status: 403 });
  const db = env.DB!;
  const { results } = await db
    .prepare(
      "SELECT m.id,a.media_generation FROM venue_admissions a JOIN venue_meetings m ON m.id=a.meeting_id WHERE m.planned_end_ms<=? LIMIT 200",
    )
    .bind(Date.now())
    .all<{ id: string; media_generation: string }>();
  await Promise.all(
    results.map(async (row) => {
      await closeRoom(row.media_generation);
      await db
        .prepare(
          "UPDATE venue_meetings SET media_closed_ms=? WHERE id=? AND media_closed_ms IS NULL AND EXISTS (SELECT 1 FROM venue_admissions WHERE meeting_id=? AND media_generation=?)",
        )
        .bind(Date.now(), row.id, row.id, row.media_generation)
        .run();
    }),
  );
  await db
    .prepare(
      "INSERT INTO her_entries(id,kind,author,target,state,data,updated) VALUES('venue/clock','venue-clock','system','','private','{}',?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated WHERE updated < excluded.updated-5000",
    )
    .bind(Date.now())
    .run();
  return Response.json({ expired: results.length });
}
