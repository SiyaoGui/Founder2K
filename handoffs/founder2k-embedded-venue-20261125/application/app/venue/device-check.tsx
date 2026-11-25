"use client";
import { useEffect, useRef, useState } from "react";

export default function DeviceCheck() {
  const camera = useRef<HTMLVideoElement>(null),
    capture = useRef<MediaStream | null>(null),
    context = useRef<AudioContext | null>(null),
    meter = useRef<HTMLMeterElement>(null);
  const [message, setMessage] = useState(""),
    [running, setRunning] = useState(false);
  const frame = useRef(0);
  function stop() {
    capture.current?.getTracks().forEach((t) => t.stop());
    capture.current = null;
    if (camera.current) camera.current.srcObject = null;
    cancelAnimationFrame(frame.current);
    if (context.current) void context.current.close();
    context.current = null;
  }
  useEffect(() => () => stop(), []);
  async function test(video: boolean) {
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video,
      });
      capture.current = stream;
      if (camera.current) camera.current.srcObject = stream;
      const ac = new AudioContext();
      context.current = ac;
      const analyser = ac.createAnalyser();
      ac.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      function level() {
        analyser.getByteTimeDomainData(samples);
        if (meter.current)
          meter.current.value =
            Math.max(...samples.map((n) => Math.abs(n - 128))) / 128;
        frame.current = requestAnimationFrame(level);
      }
      level();
      setMessage("请说句话，确认音量条跳动。");
      setRunning(true);
    } catch {
      stop();
      setRunning(false);
      setMessage("无法读取设备，请检查麦克风和摄像头权限。");
    }
  }
  return (
    <details
      onToggle={(e) => {
        if (!e.currentTarget.open) {
          stop();
          setRunning(false);
        }
      }}
    >
      <summary>入场前测试设备</summary>
      <button type="button" onClick={() => void test(true)}>
        测试摄像头和麦克风
      </button>
      <button type="button" onClick={() => void test(false)}>
        只测试麦克风
      </button>
      <video
        aria-label="本机摄像头预览"
        ref={camera}
        muted
        autoPlay
        playsInline
        style={{ width: "100%", maxHeight: 200 }}
      />
      <label>
        本机输入音量 <meter ref={meter} min={0} max={1} />
      </label>
      <p aria-live="polite">{message}</p>
      {running && (
        <button
          type="button"
          onClick={() => {
            stop();
            setRunning(false);
            setMessage("设备测试结束");
          }}
        >
          结束设备测试
        </button>
      )}
    </details>
  );
}
