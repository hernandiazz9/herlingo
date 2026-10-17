"use client";

import { useSyncExternalStore } from "react";
import { onLegacyHost, subscribeHost } from "@/lib/move";

/** True on an old address of the app (false while rendering on the server). */
export function useLegacyHost(): boolean {
  return useSyncExternalStore(subscribeHost, onLegacyHost, () => false);
}
