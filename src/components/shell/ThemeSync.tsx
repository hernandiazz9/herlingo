"use client";

import { useLayoutEffect } from "react";
import { applyTheme, readThemeChoice, subscribeThemeChoice } from "@/lib/theme";

/**
 * Mounted once in the root layout. The inline <head> script applies the stored theme before
 * paint; this re-applies it if React resets <html> attributes (dev Strict Mode remount) and keeps
 * the document in sync when the choice changes in another tab.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme(readThemeChoice());
    return subscribeThemeChoice(() => applyTheme(readThemeChoice()));
  }, []);
  return null;
}
