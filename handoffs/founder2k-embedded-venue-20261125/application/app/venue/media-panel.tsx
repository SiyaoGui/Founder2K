"use client";
import { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  createLocalScreenTracks,
  type LocalTrack,
  type RemoteTrack,
} from "livekit-client";

type Ticket = { url: string; token: string; publish: boolean };
function attach(track: RemoteTrack, container: HTMLElement) {
  const element = track.attach();
  element.autoplay = true;
  if (element instanceof HTMLVideoElement) element.playsInline = true;
  element.dataset.track = track.sid || "";
  container.appendChild(element);
}
export function MediaPanel({
  channel,
  ticket,
  enabled,
}: {
  channel: string | null;
  ticket: () => Promise<Ticket>;
  enabled: boolean;
}) {
  const el = useRef<HTMLDivElement>(null),
    session = useRef<Room | null>(null),
    get = useRef(ticket);
  get.current = ticket;
  const [status, setStatus] = useState(""),
    [retry, again] = useState(0),
    [canSend, setCanSend] = useState(false),
    [roster, setRoster] = useState<string[]>([]),
    [mic, setMic] = useState(false),
    [cam, setCam] = useState(false),
    [screen, setScreen] = useState(false),
    [audioOnly, setAudioOnly] = useState(false);
  useEffect(() => {
    setCanSend(false);
    setRoster([]);
    setMic(false);
    setCam(false);
    setScreen(false);
    setAudioOnly(false);
    setStatus("");
    if (!enabled || !channel) return;
    const room = new Room(),
      container = el.current!;
    let cancelled = false;
    session.current = room;
    const roster = () =>
      setRoster(
        [...room.remoteParticipants.values()].map((p) => p.name || "参会者"),
      );
    room
      .on(RoomEvent.TrackSubscribed, (t) => {
        if (!cancelled) attach(t, container);
      })
      .on(RoomEvent.TrackUnsubscribed, (t) =>
        t.detach().forEach((e) => e.remove()),
      )
      .on(RoomEvent.ParticipantConnected, roster)
      .on(RoomEvent.ParticipantDisconnected, roster)
      .on(RoomEvent.Reconnecting, () => setStatus("正在重新连接"))
      .on(RoomEvent.Reconnected, () => setStatus("已恢复连接"))
      .on(RoomEvent.Disconnected, () => {
        if (!cancelled) setStatus("连接已结束，请按议程重新进入");
      });
    (async () => {
      try {
        setStatus("正在连接");
        const t = await get.current();
        if (cancelled) return;
        await room.connect(t.url, t.token);
        if (cancelled) {
          await room.disconnect();
          return;
        }
        setCanSend(t.publish);
        roster();
        setStatus("媒体已连接");
      } catch (e) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : "连接失败");
      }
    })();
    return () => {
      cancelled = true;
      session.current = null;
      void room.disconnect();
      container.replaceChildren();
    };
  }, [channel, enabled, retry]);
  async function control(which: string) {
    const room = session.current;
    if (!room) return;
    try {
      const lp = room.localParticipant;
      if (which === "mic") {
        await lp.setMicrophoneEnabled(!mic);
        setMic(!mic);
      }
      if (which === "cam") {
        await lp.setCameraEnabled(!cam);
        setCam(!cam);
      }
      if (which === "screen") {
        await lp.setScreenShareEnabled(!screen);
        setScreen(!screen);
      }
      if (which === "audio") {
        for (const p of room.remoteParticipants.values())
          for (const track of p.videoTrackPublications.values())
            track.setSubscribed(audioOnly);
        setAudioOnly(!audioOnly);
      }
      if (which === "play") await room.startAudio();
    } catch {
      setStatus("设备或播放权限不可用，请检查浏览器权限后重试");
    }
  }
  return (
    <>
      <div className="venue-tracks" ref={el} />
      <p aria-live="polite">{status}</p>
      {roster.length > 0 && <p>同场 · {roster.join("、")}</p>}
      {enabled && channel && (
        <div className="venue-actions">
          <button onClick={() => control("play")}>播放声音</button>
          <button onClick={() => control("audio")}>
            {audioOnly ? "恢复视频" : "纯音频"}
          </button>
          {canSend && (
            <>
              <button onClick={() => control("mic")}>
                {mic ? "关闭麦克风" : "开启麦克风"}
              </button>
              <button onClick={() => control("cam")}>
                {cam ? "关闭摄像头" : "开启摄像头"}
              </button>
              <button onClick={() => control("screen")}>
                {screen ? "结束共享" : "共享屏幕"}
              </button>
            </>
          )}
          <button onClick={() => again((v) => v + 1)}>重新连接</button>
        </div>
      )}
    </>
  );
}

export function Presenter({
  targets,
  ticket,
}: {
  targets: { id: string; epoch: string }[];
  ticket: (id: string) => Promise<Ticket>;
}) {
  const rooms = useRef(new Map<string, Room>()),
    tracks = useRef<LocalTrack[]>([]),
    [running, setRunning] = useState(false),
    [error, setError] = useState("");
  const current = useRef(ticket);
  current.current = ticket;
  const signature = JSON.stringify(targets);
  function stop() {
    tracks.current.forEach((t) => t.stop());
    tracks.current = [];
    rooms.current.forEach((r) => void r.disconnect(false));
    rooms.current.clear();
  }
  useEffect(() => () => stop(), []);
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const targets = JSON.parse(signature) as { id: string; epoch: string }[],
      wanted = new Set(targets.map((t) => t.epoch));
    for (const [key, room] of rooms.current)
      if (!wanted.has(key)) {
        rooms.current.delete(key);
        void room.disconnect(false);
      }
    (async () => {
      for (const t of targets) {
        if (cancelled || rooms.current.has(t.epoch)) continue;
        const room = new Room();
        try {
          const a = await current.current(t.id);
          if (cancelled) return;
          await room.connect(a.url, a.token);
          if (cancelled) {
            await room.disconnect(false);
            return;
          }
          rooms.current.set(t.epoch, room);
          for (const tr of tracks.current)
            await room.localParticipant.publishTrack(
              tr.mediaStreamTrack.clone(),
              { source: tr.source },
            );
        } catch {
          await room.disconnect();
          rooms.current.delete(t.epoch);
          if (!cancelled) setError("部分组演示未连通，请检查网络并重新分发");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signature, running]);
  async function start() {
    try {
      const capture = await createLocalScreenTracks({ audio: false });
      tracks.current = capture;
      const mic = await createLocalAudioTrack();
      mic.source = Track.Source.Microphone;
      tracks.current.push(mic);
      setError("");
      setRunning(true);
      capture[0].mediaStreamTrack.onended = () => {
        stop();
        setRunning(false);
      };
    } catch {
      stop();
      setError("请允许共享演示画面和麦克风");
    }
  }
  return (
    <>
      <button
        onClick={() => (running ? (stop(), setRunning(false)) : void start())}
      >
        {running ? "停止演示分发" : "共享演示与主持人声音"}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
