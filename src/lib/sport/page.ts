/**
 * The page as Modo deporte's preparation sees it (docs/sport.md "Offline"): whether it is hidden
 * (screen locked, app in the background: iOS fails every fetch at once there although scripts
 * still run), a wait until it is visible again, a count of the times it went hidden, and a
 * Screen Wake Lock while an episode prepares. Client-only: without `document` the page counts as
 * visible and nothing is held.
 */

/** True while the page is hidden (screen locked, app in the background). */
export function pageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

/** Resolves once the page is visible: at once when it is, or when `signal` aborts. */
export function whenPageVisible(signal?: AbortSignal): Promise<void> {
  if (!pageHidden() || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pageHidden() && !signal?.aborted) return;
      document.removeEventListener("visibilitychange", check);
      signal?.removeEventListener("abort", check);
      resolve();
    };
    document.addEventListener("visibilitychange", check);
    signal?.addEventListener("abort", check);
  });
}

/**
 * Counts the times the page goes hidden from now on: a fetch that failed while the count moved
 * failed because of the background, not the network. `stop()` when done.
 */
export function countHides(): { count: () => number; stop: () => void } {
  if (typeof document === "undefined") return { count: () => 0, stop: () => {} };
  let hides = 0;
  const onChange = () => {
    if (pageHidden()) hides++;
  };
  document.addEventListener("visibilitychange", onChange);
  return { count: () => hides, stop: () => document.removeEventListener("visibilitychange", onChange) };
}

/**
 * Keeps the screen on (Screen Wake Lock) until the returned function is called (more calls do
 * nothing). The browser drops the lock when the page hides: it is asked for again when the page
 * comes back. Feature-detected, every error ignored: without it the preparation pauses while the
 * page is hidden and goes on when it comes back.
 */
export function keepScreenAwake(): () => void {
  if (typeof document === "undefined" || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
    return () => {};
  }
  let released = false;
  let asking = false;
  let lock: WakeLockSentinel | undefined;
  const request = () => {
    if (released || asking || (lock && !lock.released) || pageHidden()) return;
    asking = true;
    const settle = (sentinel?: WakeLockSentinel) => {
      asking = false;
      if (!sentinel) return;
      if (released) void sentinel.release().catch(() => {});
      else lock = sentinel;
    };
    try {
      navigator.wakeLock.request("screen").then(settle, () => settle());
    } catch {
      settle();
    }
  };
  const onChange = () => {
    if (!pageHidden()) request();
  };
  document.addEventListener("visibilitychange", onChange);
  request();
  return () => {
    if (released) return;
    released = true;
    document.removeEventListener("visibilitychange", onChange);
    void lock?.release().catch(() => {});
    lock = undefined;
  };
}
