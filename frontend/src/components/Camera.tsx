import { useLingui } from "@lingui/react/macro";
import { Maximize, VideoOff } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useApi } from "../lib/api";
import { formatDateTime } from "../lib/format";
import type { StreamStatus } from "./meteo-stream";
import "./meteo-stream";

const STREAM_WS = "/api/v1/stream/ws";
const DEFAULT_RATIO = 16 / 9;
// The backend stores a frame every minute; refresh the fallback at the same pace.
const LAST_FRAME_REFRESH_MS = 60_000;

export function Camera() {
  const { t } = useLingui();
  const frameRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<StreamStatus>({ state: "connecting" });
  // The frame takes the camera's own proportions so the picture is never letterboxed.
  const [ratio, setRatio] = useState(DEFAULT_RATIO);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    // Created by hand: React would not set `src` as a property on a custom element.
    const player = document.createElement("meteo-stream") as HTMLElement & { src: string };
    const onStatus = (event: Event) => setStatus((event as CustomEvent<StreamStatus>).detail);
    player.addEventListener("streamstatus", onStatus);
    player.className = "block size-full";
    frame.prepend(player);
    player.src = STREAM_WS;
    const video = player.querySelector("video");
    const onResize = () => {
      if (video?.videoWidth) setRatio(video.videoWidth / video.videoHeight);
    };
    video?.addEventListener("resize", onResize);
    return () => {
      video?.removeEventListener("resize", onResize);
      player.removeEventListener("streamstatus", onStatus);
      player.remove();
    };
  }, []);

  const fullscreen = () => frameRef.current?.requestFullscreen?.();

  return (
    <section
      ref={frameRef}
      aria-label={t`Live camera`}
      style={{ aspectRatio: ratio, "--camera-ratio": ratio } as CSSProperties}
      // On desktop the height is capped so the history chart keeps room below.
      className="relative mx-auto w-full max-w-[calc(var(--camera-max-h)*var(--camera-ratio))] shrink-0 overflow-hidden rounded-2xl border border-border bg-black shadow-sm [--camera-max-h:100vh] lg:[--camera-max-h:62dvh]"
    >
      {status.state === "offline" && <LastFrame onRatio={setRatio} />}
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2">
        <StatusBadge status={status} />
      </div>
      <button
        type="button"
        onClick={fullscreen}
        aria-label={t`Full screen`}
        title={t`Full screen`}
        className="absolute right-3 bottom-3 flex size-11 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-white"
      >
        <Maximize aria-hidden className="size-5" />
      </button>
    </section>
  );
}

/** Covers the dead player with the last stored frame and says how old it is. */
function LastFrame({ onRatio }: { onRatio: (ratio: number) => void }) {
  const { t } = useLingui();
  const { data } = useApi<{ captured_at: string }>("/api/v1/stream/last", LAST_FRAME_REFRESH_MS);

  if (!data) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-slate-200">
        <VideoOff aria-hidden className="size-10" />
        <p>{t`Camera offline, reconnecting…`}</p>
      </div>
    );
  }
  const when = formatDateTime(data.captured_at);
  return (
    <div className="absolute inset-0 bg-black">
      <img
        src={`/api/v1/stream/last.jpg?t=${encodeURIComponent(data.captured_at)}`}
        alt={t`Last camera image, taken ${when}`}
        onLoad={(event) => {
          const img = event.currentTarget;
          if (img.naturalWidth) onRatio(img.naturalWidth / img.naturalHeight);
        }}
        className="size-full object-contain opacity-70 grayscale-[40%]"
      />
      <p
        role="status"
        // Top, so it doesn't hide the date the camera prints at the bottom.
        className="absolute inset-x-3 top-12 flex w-fit items-center gap-2 rounded-xl bg-black/70 px-3 py-2 text-sm text-white backdrop-blur"
      >
        <VideoOff aria-hidden className="size-4 shrink-0" />
        {t`Camera offline · last image ${when} · reconnecting…`}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: StreamStatus }) {
  const { t } = useLingui();
  const base =
    "flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-sm font-medium text-white backdrop-blur";
  if (status.state === "live") {
    return (
      <span className={base}>
        <span aria-hidden className="size-2 rounded-full bg-red-500" />
        {t`Live`}
        <span className="font-mono text-xs text-white/70">{status.mode}</span>
      </span>
    );
  }
  if (status.state === "offline") {
    return (
      <span className={base}>
        <span aria-hidden className="size-2 rounded-full bg-slate-400" />
        {t`Offline`}
      </span>
    );
  }
  return <span className={base}>{t`Connecting…`}</span>;
}
