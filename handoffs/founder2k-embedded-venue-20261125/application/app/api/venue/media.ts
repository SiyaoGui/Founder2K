import { env } from "cloudflare:workers";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { requireVenue } from "./source";
type MediaEnv = {
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
};
const config = () => env as unknown as MediaEnv;
export const available = () =>
  Boolean(
    config().LIVEKIT_URL &&
      config().LIVEKIT_API_KEY &&
      config().LIVEKIT_API_SECRET,
  );
export function service() {
  requireVenue(available(), 503, "媒体服务尚未配置。可使用议程、签到和求助。");
  const c = config();
  return new RoomServiceClient(
    c.LIVEKIT_URL!.replace(/^ws/, "http"),
    c.LIVEKIT_API_KEY,
    c.LIVEKIT_API_SECRET,
  );
}
export async function grant(
  room: string,
  identity: string,
  name: string,
  publish: boolean,
  subscribe: boolean,
) {
  const s = service(),
    c = config();
  if (room.startsWith("pair."))
    requireVenue(
      (await s.listRooms([room])).length,
      409,
      "会谈媒体已关闭，请结束本轮或申请补谈",
    );
  else await s.createRoom({ name: room, emptyTimeout: 60 });
  const t = new AccessToken(c.LIVEKIT_API_KEY, c.LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: 15,
  });
  t.addGrant({
    room,
    roomJoin: true,
    canSubscribe: subscribe,
    canPublish: publish,
    canPublishData: false,
  });
  return {
    url: c.LIVEKIT_URL!,
    token: await t.toJwt(),
    room,
    publish,
    subscribe,
  };
}
export async function closeRoom(room: string) {
  const s = service();
  if ((await s.listRooms([room])).length) await s.deleteRoom(room);
}

export async function preparePair() {
  const row = await env
    .DB!.prepare(
      "SELECT updated FROM her_entries WHERE id='venue/clock' AND kind='venue-clock'",
    )
    .first<{ updated: number }>();
  requireVenue(
    row && Date.now() - row.updated < 15000,
    503,
    "截止调度服务离线，请稍后进入",
  );
  const name = "pair." + crypto.randomUUID();
  await service().createRoom({
    name,
    maxParticipants: 2,
    emptyTimeout: 120,
    departureTimeout: 60,
  });
  return name;
}
