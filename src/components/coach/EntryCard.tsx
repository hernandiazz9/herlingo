import Link from "next/link";
import { cn } from "@/lib/cn";
import { ChevronRightIcon, SparklesIcon } from "./icons";
import { PREPARE_HREF } from "./nav";
import { FOCUS } from "./shared";

/** Highlighted card at the top of /jugar/ that opens Prepárate. */
export function EntryCard() {
  return (
    <Link
      href={PREPARE_HREF}
      className={cn(
        "pressable flex items-center gap-4 rounded-card border-2 border-sea bg-sea-soft p-4 [--ledge:var(--sea-ledge)]",
        FOCUS,
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sea text-on-accent">
        <SparklesIcon width={26} height={26} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-lg font-extrabold leading-tight text-ink">Prepárate para una situación</span>
        <span className="text-sm font-bold text-sea-deep">Cuéntame qué vas a hacer y te preparo</span>
      </span>
      <ChevronRightIcon className="shrink-0 text-sea-deep" />
    </Link>
  );
}
