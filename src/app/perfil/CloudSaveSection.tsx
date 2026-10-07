"use client";

import { useEffect, useState, type ComponentType } from "react";
import { leagueEnabled } from "@/lib/league/config";

/**
 * Perfil → "Guardado en la nube". Loaded lazily and only when Liga is configured (like
 * `CloudSaveHost`), so the cloud save is not part of Perfil's first-load JS; without Liga it
 * renders nothing.
 */
export function CloudSaveSection() {
  const [Section, setSection] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (!leagueEnabled()) return;
    let alive = true;
    import("@/components/cloud-save/CloudSaveCard").then(
      (m) => {
        if (alive) setSection(() => m.CloudSaveCard);
      },
      () => {
        // Chunk unavailable (offline dev server): no card on this page.
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  return Section ? <Section /> : null;
}
