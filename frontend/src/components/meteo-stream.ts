import { VideoRTC } from "../vendor/video-rtc.js";

export type StreamStatus =
  | { state: "connecting" }
  | { state: "live"; mode: string }
  | { state: "offline"; reason: string };

// Retry often enough that a camera coming back shows up quickly, without hammering it.
const RETRY_MS = 10_000;
// No first frame in this long, or the picture frozen this long, means the camera is gone.
const START_TIMEOUT_MS = 20_000;
const STALL_TIMEOUT_MS = 12_000;
const WATCHDOG_MS = 3_000;

/**
 * go2rtc's player with what this page needs: video only, no native controls, a
 * `streamstatus` event for the React overlay, and self-healing. VideoRTC only reconnects
 * when the WebSocket drops; a dead camera (go2rtc error) or a frozen picture would stay
 * stuck, so the watchdog tears the session down and starts over.
 */
class MeteoStream extends VideoRTC {
  private status: StreamStatus = { state: "connecting" };
  private watchdog = 0;
  private retryTimer = 0;
  private sessionStart = 0;
  private lastProgress = 0;
  private lastTime = -1;

  constructor() {
    super();
    this.mode = "webrtc,mse,hls";
    this.media = "video";
  }

  private emit(status: StreamStatus): void {
    this.status = status;
    this.dispatchEvent(new CustomEvent<StreamStatus>("streamstatus", { detail: status }));
  }

  oninit(): void {
    super.oninit();
    this.video.controls = false;
    this.video.muted = true;
    this.video.addEventListener("timeupdate", () => {
      if (this.video.currentTime === this.lastTime) return;
      this.lastTime = this.video.currentTime;
      this.lastProgress = Date.now();
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.watchdog ||= window.setInterval(() => this.check(), WATCHDOG_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.watchdog);
    window.clearTimeout(this.retryTimer);
    this.watchdog = 0;
  }

  onconnect(): boolean {
    const started = super.onconnect();
    if (!started) return false;
    this.sessionStart = Date.now();
    this.lastProgress = 0;
    // While offline, retries stay "offline" so the last frame doesn't flicker away.
    if (this.status.state !== "offline") this.emit({ state: "connecting" });
    return true;
  }

  onopen(): string[] {
    const modes = super.onopen();
    this.onmessage.status = (msg) => {
      // A WebRTC failure (e.g. port 8555 unreachable from outside) leaves MSE running;
      // anything else (camera unreachable) needs a fresh session.
      if (msg.type === "error" && !msg.value.startsWith("webrtc")) this.restart(msg.value);
      else if (msg.type === "mse" || msg.type === "hls") this.markLive(msg.type.toUpperCase());
    };
    return modes;
  }

  onpcvideo(video: HTMLVideoElement): void {
    super.onpcvideo(video);
    if (this.pcState !== WebSocket.CLOSED) this.markLive("WebRTC");
  }

  private markLive(mode: string): void {
    this.lastProgress = Date.now();
    this.emit({ state: "live", mode });
  }

  private check(): void {
    if (document.hidden || this.retryTimer) return;
    const now = Date.now();
    if (this.status.state === "live") {
      if (now - this.lastProgress > STALL_TIMEOUT_MS) this.restart("stalled");
    } else if (this.sessionStart && now - this.sessionStart > START_TIMEOUT_MS) {
      this.restart("timeout");
    }
  }

  /** Drop WebSocket and WebRTC, then reconnect after a pause. */
  private restart(reason: string): void {
    this.emit({ state: "offline", reason });
    this.ondisconnect();
    this.sessionStart = 0;
    window.clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = 0;
      this.onconnect();
    }, RETRY_MS);
  }
}

if (!customElements.get("meteo-stream")) customElements.define("meteo-stream", MeteoStream);
