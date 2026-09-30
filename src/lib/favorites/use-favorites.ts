"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { parseFavorites, readFavoritesRaw, subscribeFavorites, toggleFavorite } from "./index";

const serverSnapshot = () => "";

/** Favourite ids of a pack, live, plus a toggle. Empty on the server and before hydration. */
export function useFavorites(lang: string) {
  const raw = useSyncExternalStore(
    subscribeFavorites,
    () => readFavoritesRaw(lang),
    serverSnapshot,
  );
  const favorites = useMemo(() => parseFavorites(raw), [raw]);
  const toggle = useCallback((id: string) => toggleFavorite(lang, id), [lang]);
  return { favorites, toggle };
}
