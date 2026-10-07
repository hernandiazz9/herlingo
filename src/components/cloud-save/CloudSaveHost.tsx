"use client";

import { useEffect, useState, type ComponentType } from "react";
import { leagueEnabled } from "@/lib/league/config";

/**
 * Mounts the cloud save's launch prompt (`CloudSavePrompt`) app-wide. Loaded lazily and only when
 * Liga is configured, like `LeagueSync`, so the cloud save is not part of any route's first-load JS.
 */
export function CloudSaveHost() {
  const [Prompt, setPrompt] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (!leagueEnabled()) return;
    let alive = true;
    import("./CloudSavePrompt").then(
      (m) => {
        if (alive) setPrompt(() => m.CloudSavePrompt);
      },
      () => {
        // Chunk unavailable (offline dev server): no prompt on this page.
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  return Prompt ? <Prompt /> : null;
}
