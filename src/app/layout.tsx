import type { Metadata, Viewport } from "next";
import { LeagueSync } from "@/components/league/LeagueSync";
import { InstallPrompt } from "@/components/shell/InstallPrompt";
import { XpToast } from "@/components/shell/XpToast";
import { TabBar } from "@/components/shell/TabBar";
import { ThemeSync } from "@/components/shell/ThemeSync";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app-config";
import { APPLE_TOUCH_ICON, MANIFEST_PATH } from "@/lib/pwa/manifest";
import { UpdatePrompt } from "@/lib/pwa/UpdatePrompt";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  // Installable PWA: manifest and sw.js are written into out/ by scripts/pwa/build.ts (postbuild).
  manifest: MANIFEST_PATH,
  // Setting `icons` replaces the file-based app/icon.svg link, so it is listed here too.
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: APPLE_TOUCH_ICON },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout extend under the notch / home indicator; the shell pads with env(safe-area-inset-*).
  viewportFit: "cover",
  // Follows the system theme; the inline script / ThemeSync override it when the user picks one.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the inline theme script sets data-theme on <html> before React hydrates.
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Applies the stored Sistema/Claro/Oscuro choice before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ThemeSync />
        <LeagueSync />
        <XpToast />
        {/* Centred mobile-width column: full width on phones, a phone-sized column on desktop. */}
        <div
          className="relative mx-auto flex min-h-dvh w-full max-w-[var(--column-width)] flex-col bg-cream shadow-[0_0_0_1px_var(--line),0_12px_40px_-12px_var(--shadow)]"
        >
          {/* Sicilian ribbon: lemon, sea and terracotta. Sits under the status bar. */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto h-1.5 w-full max-w-[var(--column-width)] bg-[linear-gradient(90deg,var(--lemon)_0_33.3%,var(--sea)_33.3%_66.6%,var(--terracotta)_66.6%_100%)]"
          />
          <main
            className="flex flex-1 flex-col gap-5 pt-[calc(1.5rem+var(--safe-top))] pb-[calc(var(--tabbar-height)+var(--safe-bottom)+1.5rem)] pl-[calc(1.25rem+env(safe-area-inset-left))] pr-[calc(1.25rem+env(safe-area-inset-right))]"
          >
            {children}
          </main>
          <TabBar />
          <UpdatePrompt />
          <InstallPrompt />
        </div>
      </body>
    </html>
  );
}
