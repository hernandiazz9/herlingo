import type { Metadata, Viewport } from "next";
import { TabBar } from "@/components/shell/TabBar";
import { APP_DESCRIPTION, APP_NAME, THEME_COLOR } from "@/lib/app-config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout extend under the notch / home indicator; the shell pads with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: THEME_COLOR,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">
        {/* Centred mobile-width column: full width on phones, a phone-sized column on desktop. */}
        <div
          className="relative mx-auto flex min-h-dvh w-full max-w-[var(--column-width)] flex-col bg-cream shadow-[0_0_0_1px_var(--line),0_12px_40px_-12px_rgb(30_41_53/0.25)]"
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
        </div>
      </body>
    </html>
  );
}
