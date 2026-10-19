// Minimal typings for the parts of go2rtc's VideoRTC (video-rtc.js, v1.9.14) we use.
export class VideoRTC extends HTMLElement {
  mode: string;
  media: string;
  background: boolean;
  visibilityCheck: boolean;
  video: HTMLVideoElement;
  pcState: number;
  onmessage: Record<string, (msg: { type: string; value: string }) => void>;
  set src(value: string);
  connectedCallback(): void;
  disconnectedCallback(): void;
  oninit(): void;
  onconnect(): boolean;
  ondisconnect(): void;
  onopen(): string[];
  onclose(): boolean;
  onpcvideo(video: HTMLVideoElement): void;
}
