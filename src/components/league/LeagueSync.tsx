"use client";

import { useEffect } from "react";
import { leagueEnabled } from "@/lib/league/config";

/**
 * Starts the Liga XP sync (docs/league.md → "Sync") once per page. Renders nothing. The sync
 * module (and with it the account layer) is loaded lazily and only when Liga is configured, so it
 * is not part of any route's first-load JS; supabase-js itself only loads when there is something
 * to send.
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
  }, []);
  return null;
}
