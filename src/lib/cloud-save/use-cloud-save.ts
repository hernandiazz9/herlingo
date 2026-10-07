"use client";

import { useSyncExternalStore } from "react";
import { getCloudSaveState, getServerCloudSaveState, subscribeCloudSave, type CloudSaveState } from "./index";

/**
 * The cloud save state, live: `{ status, lastSyncAt, lastError, size, needsEmail, enabled }`.
 * `off` on the server, during hydration and when Liga is not configured. Reading it never makes a
 * request (the sync is started by the app shell).
 */
export function useCloudSave(): CloudSaveState {
  return useSyncExternalStore(subscribeCloudSave, getCloudSaveState, getServerCloudSaveState);
}
