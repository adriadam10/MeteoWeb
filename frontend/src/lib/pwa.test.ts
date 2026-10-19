import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useInstall } from "./pwa";

function fireInstallPrompt() {
  const event = Object.assign(new Event("beforeinstallprompt"), {
    prompt: vi.fn().mockResolvedValue({ outcome: "accepted" }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

test("install is only offered after the browser's prompt, and only once", async () => {
  const { result } = renderHook(() => useInstall());
  expect(result.current).toBeNull();

  const event = fireInstallPrompt();
  expect(result.current).not.toBeNull();

  await act(async () => {
    await result.current?.();
  });
  expect(event.prompt).toHaveBeenCalledOnce();
  expect(result.current).toBeNull();
});
