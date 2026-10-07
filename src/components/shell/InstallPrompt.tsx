"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { isStandalone } from "@/lib/speech";

const DISMISS_KEY = "lang-lern:install-dismissed";
const DISMISS_DAYS = 7;
const INSTALL_HREF = "/instalar/";

/** Chrome/Android only: the native install dialog, kept from `beforeinstallprompt`. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function isMobile(): boolean {
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/** Banner on a phone browser tab (not the installed app): install, or open the guide. */
export function InstallPrompt() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [native, setNative] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || !isMobile() || dismissedRecently()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setNative(e as InstallPromptEvent);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const t = window.setTimeout(() => setShow(true), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show || pathname === INSTALL_HREF) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setShow(false);
  };

  const install = async () => {
    if (!native) return;
    await native.prompt();
    const { outcome } = await native.userChoice;
    setNative(null);
    if (outcome === "accepted") setShow(false);
  };

  return (
    <div className="fixed inset-x-0 top-[calc(var(--safe-top)+0.75rem)] z-50 mx-auto w-full max-w-[var(--column-width)] px-4">
      <div
        role="status"
        className="flex flex-col gap-3 rounded-card border-2 border-lemon bg-lemon-soft p-4 shadow-[0_12px_40px_-12px_var(--shadow)]"
      >
        <p className="text-base font-bold text-ink">Instala la app para usarla sin conexión: en el avión, en el metro o sin datos.</p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="min-h-12 px-2 text-sm font-bold text-ink-muted focus-visible:outline-3 focus-visible:outline-lemon-deep"
          >
            Ahora no
          </button>
          {native ? (
            <Button size="md" onClick={install}>
              Instalar
            </Button>
          ) : (
            <Link
              href={INSTALL_HREF}
              onClick={() => setShow(false)}
              className="pressable inline-flex min-h-12 items-center rounded-button bg-sea px-5 text-base font-bold text-on-accent [--ledge:var(--sea-ledge)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
            >
              Ver cómo
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
