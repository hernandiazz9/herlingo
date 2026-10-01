/**
 * App sections and the bottom tab bar. Single source of truth: the TabBar and the page headings
 * read from here. Framework-free (no React imports).
 */

/** Sections with their own button in the tab bar, in bar order. */
export type TabId = "path" | "stories" | "play" | "phrasebook" | "profile";
/** Every section with a heading: the tabs plus the ones reached from another tab's page. */
export type SectionId = TabId | "review" | "dialogues" | "league";

export interface Section {
  id: SectionId;
  /** Route, without trailing slash. */
  href: string;
  /** Short label (under the icon in the tab bar). */
  label: string;
  /** Page heading (h1). */
  title: string;
}

export interface Tab extends Section {
  id: TabId;
  /** The big raised button in the middle of the bar. */
  central?: boolean;
}

export const TABS: readonly Tab[] = [
  { id: "path", href: "/", label: "Ruta", title: "Tu ruta" },
  { id: "stories", href: "/historias", label: "Historias", title: "Historias" },
  { id: "play", href: "/jugar", label: "Jugar", title: "Jugar", central: true },
  { id: "phrasebook", href: "/frasario", label: "Frases", title: "Frasario" },
  { id: "profile", href: "/perfil", label: "Perfil", title: "Tu perfil" },
];

/** Sections without a tab: reached from cards on another tab's page, which stays highlighted. */
const NESTED: readonly (Section & { parent: TabId })[] = [
  { id: "review", href: "/repaso", label: "Repaso", title: "Repaso", parent: "path" },
  { id: "dialogues", href: "/dialogos", label: "Diálogos", title: "Diálogos", parent: "path" },
  { id: "league", href: "/liga", label: "Liga", title: "Liga", parent: "profile" },
];

export function getTab(id: SectionId): Section {
  const section = TABS.find((t) => t.id === id) ?? NESTED.find((s) => s.id === id);
  if (!section) throw new Error(`Unknown section: ${id}`);
  return section;
}

/** Strips the trailing slash that `trailingSlash: true` adds (except for the root). */
export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function owns(href: string, path: string): boolean {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

/**
 * The tab that owns a pathname: exact match for "/", prefix match for the rest.
 * Nested sections (Repaso, Diálogos, Liga) light up their parent tab.
 */
export function activeTabFor(pathname: string): Tab | undefined {
  const path = normalizePath(pathname);
  const tab = TABS.find((t) => owns(t.href, path));
  if (tab) return tab;
  const nested = NESTED.find((s) => owns(s.href, path));
  return nested ? TABS.find((t) => t.id === nested.parent) : undefined;
}
