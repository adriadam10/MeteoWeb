import { useSyncExternalStore } from "react";

// Chrome's install prompt, not in TypeScript's DOM types.
interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Chrome fires beforeinstallprompt once, maybe before React mounts, so it is kept from module load.
// Only when the app can be installed and isn't yet: other browsers never fire it.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/** null when the browser doesn't offer to install (installed, opened as the app, unsupported). */
export function useInstall(): (() => Promise<void>) | null {
  const available = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => deferred !== null,
  );
  if (!available) return null;
  return async () => {
    const event = deferred;
    if (!event) return;
    // A prompt can only be shown once; a dismissed one comes back with the next event.
    deferred = null;
    notify();
    await event.prompt();
  };
}

// The worker only keeps the offline page (public/sw.js); in development Vite serves none.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("/sw.js")
    .catch((error) => console.error("service worker:", error));
}
