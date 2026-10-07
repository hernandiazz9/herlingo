"use client";

import { useEffect } from "react";
import { leagueEnabled } from "@/lib/league/config";

/**
 * Starts the Liga XP sync (docs/league.md → "Sync") and the cloud save (`@/lib/cloud-save`, plan
 * 010) once per page. Renders nothing. Both modules (and with them the account layer) are loaded
 * lazily and only when Liga is configured, so they are not part of any route's first-load JS;
 * supabase-js itself only loads when there is something to send.
 */
export function LeagueSync() {
  useEffect(() => {
    if (!leagueEnabled()) return;
    import("@/lib/league/sync").then(
      ({ startLeagueSync }) => startLeagueSync(),
      () => {
        // Chunk unavailable (offline dev server): no sync on this page.
      },
    );
    import("@/lib/cloud-save").then(
      ({ startCloudSave }) => startCloudSave(),
      () => {
        // Chunk unavailable: no cloud save on this page.
      },
    );
  }, []);
  return null;
}
