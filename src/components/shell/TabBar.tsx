"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { PathIcon, PhrasebookIcon, ProfileIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { TABS, activeTabFor, type Tab, type TabId } from "@/lib/navigation";
import { GameIcon, StoriesIcon } from "./icons";

const ICONS: Record<TabId, ComponentType<SVGProps<SVGSVGElement>>> = {
  path: PathIcon,
  stories: StoriesIcon,
  play: GameIcon,
  phrasebook: PhrasebookIcon,
  profile: ProfileIcon,
};

const FOCUS = "focus-visible:outline-3 focus-visible:outline-lemon-deep";

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
        {TABS.map((tab) => (
          <li key={tab.id} className="flex">
            {tab.central ? (
              <CentralTab tab={tab} isActive={active?.id === tab.id} />
            ) : (
              <RegularTab tab={tab} isActive={active?.id === tab.id} />
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface TabProps {
  tab: Tab;
  isActive: boolean;
}

function RegularTab({ tab, isActive }: TabProps) {
  const Icon = ICONS[tab.id];
  return (
    <Link
      href={tab.href}
      aria-current={isActive ? "page" : undefined}
      data-tab={tab.id}
      className={cn(
        "group flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold",
        "transition-colors active:scale-95 motion-reduce:active:scale-100",
        FOCUS,
        "focus-visible:-outline-offset-4",
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
  );
}

/** The raised round button in the middle of the bar (Jugar). */
function CentralTab({ tab, isActive }: TabProps) {
  const Icon = ICONS[tab.id];
  return (
    <Link
      href={tab.href}
      aria-current={isActive ? "page" : undefined}
      data-tab={tab.id}
      className={cn(
        "group flex flex-1 flex-col items-center justify-end gap-0.5 pb-2 text-xs font-extrabold",
        "rounded-card focus-visible:outline-offset-2",
        FOCUS,
        isActive ? "text-terracotta-deep" : "text-ink",
      )}
    >
      <span
        className={cn(
          "pressable -mt-7 flex size-16 items-center justify-center rounded-full",
          "border-4 border-surface bg-terracotta text-on-accent [--ledge:var(--terracotta-ledge)]",
          "group-active:translate-y-[var(--press-depth)] group-active:shadow-none",
          isActive && "outline-3 outline-offset-1 outline-lemon",
        )}
      >
        <Icon className="size-8" />
      </span>
      <span>{tab.label}</span>
    </Link>
  );
}
