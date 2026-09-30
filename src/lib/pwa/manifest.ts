import { APP_DESCRIPTION, APP_NAME, THEME_COLOR } from "@/lib/app-config";

/** Path of the web app manifest, written into out/ at build time (scripts/pwa/build.ts). */
export const MANIFEST_PATH = "/manifest.webmanifest";

/** iOS home-screen icon (180×180, full-bleed: iOS rounds the corners). */
export const APPLE_TOUCH_ICON = "/icons/apple-touch-icon.png";

/** Splash background while the installed app starts. Matches light --cream in globals.css. */
const BACKGROUND_COLOR = "#fffaf0";

/** The web app manifest (name and colours come from app-config). */
export function webManifest() {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    lang: "es",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: APPLE_TOUCH_ICON, sizes: "180x180", type: "image/png" },
    ],
  };
}
