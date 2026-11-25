import { env } from "cloudflare:workers";
import { WebhookReceiver } from "livekit-server-sdk";
import { service } from "../media";
export async function POST(req: Request) {
  const c = env as unknown as {
    LIVEKIT_API_KEY?: string;
    LIVEKIT_API_SECRET?: string;
  };
  if (!c.LIVEKIT_API_KEY || !c.LIVEKIT_API_SECRET)
    return new Response(null, { status: 503 });
  let event;
  try {
    event = await new WebhookReceiver(
      c.LIVEKIT_API_KEY,
      c.LIVEKIT_API_SECRET,
    ).receive(await req.text(), req.headers.get("Authorization") || "");
  } catch {
    return new Response(null, { status: 401 });
  }
  const room = event.room?.name;
  if (event.event === "participant_joined" && room?.startsWith("pair.")) {
    const db = env.DB!,
      row = await db
        .prepare(
          "SELECT m.id,m.event_id,m.appointment_id FROM venue_meetings m JOIN venue_admissions a ON a.meeting_id=m.id WHERE a.media_generation=? AND m.media_connected_ms IS NULL",
        )
        .bind(room)
        .first<{ id: string; event_id: string; appointment_id: string }>();
    if (row) {
      const arrivals = await service().listParticipants(room);
      const [, , lead, partner] = row.appointment_id.split(".");
      if (
        [lead, partner].every((id) => arrivals.some((a) => a.identity === id))
      )
        await db
          .prepare(
            "UPDATE venue_meetings SET media_connected_ms=? WHERE id=? AND media_connected_ms IS NULL AND media_closed_ms IS NULL",
          )
          .bind(Date.now(), row.id)
          .run();
    }
  }
  if (
    room?.startsWith("presentation.") &&
    [
      "track_published",
      "track_unpublished",
      "participant_left",
      "room_finished",
    ].includes(event.event)
  ) {
    const eventId = room.split(".")[1],
      db = env.DB!;
    const live = await service().listRooms([room]);
    let tracks: string[] = [];
    if (live.length) {
      const people = await service().listParticipants(room);
      tracks =
        people
          .find((p) => p.identity === "presenter")
          ?.tracks.map((t) => t.mimeType) || [];
    }
    const healthy =
      tracks.some((t) => t.startsWith("audio/")) &&
      tracks.some((t) => t.startsWith("video/"));
    await db
      .prepare(
        "INSERT INTO her_entries(id,kind,author,target,state,data,updated) VALUES(?,'venue-signal','media',?,?,'{}',?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,updated=excluded.updated",
      )
      .bind(
        "signal/" + room,
        eventId,
        healthy ? "演示源音视频已连入" : "演示信号待确认",
        Date.now(),
      )
      .run();
  }
  if (
    room?.startsWith("pair.") &&
    event.participant &&
    ["participant_joined", "participant_left"].includes(event.event)
  ) {
    const db = env.DB!;
    await db
      .prepare(
        "INSERT OR IGNORE INTO her_entries(id,kind,author,target,state,data,updated) SELECT ?, 'venue-log','media',m.event_id,'private',?,? FROM venue_meetings m JOIN venue_admissions a ON a.meeting_id=m.id WHERE a.media_generation=?",
      )
      .bind(
        "media/" + event.id,
        JSON.stringify({
          action: event.event,
          member: event.participant.identity,
          room,
        }),
        Number(event.createdAt) * 1000,
        room,
      )
      .run();
  }
  return new Response(null, { status: 204 });
}
