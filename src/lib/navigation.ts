/**
 * The bottom tab bar. Single source of truth for the main sections: the TabBar and the page
 * headings read from here. Framework-free (no React imports).
 */
export type TabId = "path" | "review" | "phrasebook" | "dialogues" | "profile";

export interface Tab {
  id: TabId;
  /** Route, without trailing slash. */
  href: string;
  /** Short label under the icon. */
  label: string;
  /** Page heading (h1). */
  title: string;
}

export const TABS: readonly Tab[] = [
  { id: "path", href: "/", label: "Ruta", title: "Tu ruta" },
  { id: "review", href: "/repaso", label: "Repaso", title: "Repaso" },
  { id: "phrasebook", href: "/frasario", label: "Frases", title: "Frasario" },
  { id: "dialogues", href: "/dialogos", label: "Diálogos", title: "Diálogos" },
  { id: "profile", href: "/perfil", label: "Perfil", title: "Tu perfil" },
];

export function getTab(id: TabId): Tab {
  const tab = TABS.find((t) => t.id === id);
  if (!tab) throw new Error(`Unknown tab: ${id}`);
  return tab;
}

/** Strips the trailing slash that `trailingSlash: true` adds (except for the root). */
export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

/** The tab that owns a pathname: exact match for "/", prefix match for the rest. */
export function activeTabFor(pathname: string): Tab | undefined {
  const path = normalizePath(pathname);
  return TABS.find((t) =>
    t.href === "/" ? path === "/" : path === t.href || path.startsWith(`${t.href}/`),
  );
}
