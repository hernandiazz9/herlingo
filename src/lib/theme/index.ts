import { THEME_COLOR } from "@/lib/app-config";

/**
 * Theme choice stored on the device. "system" follows prefers-color-scheme (no data-theme on
 * <html>); "light"/"dark" set data-theme on <html>, which globals.css keys the tokens on.
 */
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

export const THEME_STORAGE_KEY = "lang-lern:theme";

/** Browser UI colour per theme: sea blue in light, the dark column colour (--cream) in dark. */
export const THEME_COLORS = { light: THEME_COLOR, dark: "#141c24" } as const;

/** Event fired on window when the choice changes in this tab (storage events cover other tabs). */
export const THEME_CHANGE_EVENT = "lang-lern:theme-change";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Plain-JS twin of applyTheme() for the inline <head> script (runs before first paint).
 * Self-contained ES5; keep it in sync with applyTheme(). Sets/removes data-theme and points every
 * theme-color meta at the chosen colour; with "system" each meta gets back its original colour
 * and its media query decides.
 */
const APPLY_THEME_SOURCE = `function(choice){
  var root=document.documentElement;
  var colors=${JSON.stringify(THEME_COLORS)};
  if(choice==="light"||choice==="dark"){root.setAttribute("data-theme",choice);}else{root.removeAttribute("data-theme");}
  var metas=document.querySelectorAll('meta[name="theme-color"]');
  for(var i=0;i<metas.length;i++){
    var m=metas[i];
    if(!m.hasAttribute("data-default")){m.setAttribute("data-default",m.getAttribute("content")||"");}
    m.setAttribute("content",choice==="light"||choice==="dark"?colors[choice]:m.getAttribute("data-default"));
  }
}`;

/** Inline script for <head>: reads the stored choice and applies it before first paint. */
export const THEME_INIT_SCRIPT = `(function(){try{var apply=${APPLY_THEME_SOURCE};var c=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(c!=="light"&&c!=="dark")return;apply(c);if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",function(){apply(c);});}}catch(e){}})();`;

/** Applies a choice to the document (client only). Mirrors APPLY_THEME_SOURCE: keep them in sync. */
export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const explicit = choice === "light" || choice === "dark";
  if (explicit) root.setAttribute("data-theme", choice);
  else root.removeAttribute("data-theme");
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    if (!meta.hasAttribute("data-default")) meta.setAttribute("data-default", meta.content);
    meta.content = explicit ? THEME_COLORS[choice] : (meta.getAttribute("data-default") ?? "");
  });
}

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

/** Saves, applies and announces a new choice. */
export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage unavailable (private mode): the choice still applies for this visit.
  }
  applyTheme(choice);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** Subscribes to choice changes in this tab and in other tabs (for useSyncExternalStore). */
export function subscribeThemeChoice(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      applyTheme(readThemeChoice());
      onChange();
    }
  };
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
