"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import {
  DialoguesIcon,
  PathIcon,
  PhrasebookIcon,
  ProfileIcon,
  ReviewIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";
import { TABS, activeTabFor, type TabId } from "@/lib/navigation";

const ICONS: Record<TabId, ComponentType<SVGProps<SVGSVGElement>>> = {
  path: PathIcon,
  review: ReviewIcon,
  phrasebook: PhrasebookIcon,
  dialogues: DialoguesIcon,
  profile: ProfileIcon,
};

/** Bottom tab bar, fixed to the bottom of the mobile column, clear of the iPhone home indicator. */
export function TabBar() {
  const pathname = usePathname() ?? "/";
  const active = activeTabFor(pathname);

  return (
    <nav
      aria-label="Secciones"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[var(--column-width)]",
        "border-t-2 border-line bg-surface/95 backdrop-blur",
        "pb-[var(--safe-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
      )}
    >
      <ul className="grid h-[var(--tabbar-height)] grid-cols-5">
        {TABS.map((tab) => {
          const Icon = ICONS[tab.id];
          const isActive = active?.id === tab.id;
          return (
            <li key={tab.id} className="flex">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                data-tab={tab.id}
                className={cn(
                  "group flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold",
                  "transition-colors active:scale-95 motion-reduce:active:scale-100",
                  "focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-lemon-deep",
                  isActive ? "text-sea" : "text-ink-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    isActive && "bg-lemon-soft",
                  )}
                >
                  <Icon className="size-6" />
                </span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
