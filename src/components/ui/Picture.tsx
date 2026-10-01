import type { ImageRef } from "@/lib/content";
import { cn } from "@/lib/cn";

/**
 * - `grid`: fills its container's width (a cell of a 2×2 picture grid, a Frasario card), square.
 * - `intro`: 160px, for the new-word card and game word cards.
 * - `avatar`: 40px, next to a dialogue speaker's bubble.
 */
export type PictureSize = "grid" | "intro" | "avatar";

export interface PictureProps {
  /** The resolved picture: `vocab.image`, `turn.avatar` (from `@/lib/content`). */
  image: ImageRef;
  /**
   * Accessible text (Spain Spanish or the target word, e.g. "el café"). Pass "" when the word is
   * already written next to the picture, so screen readers do not read it twice.
   */
  alt: string;
  size?: PictureSize;
  /** Draw the card border (default true). Turn off when the parent (an option button) has one. */
  bordered?: boolean;
  className?: string;
}

const SIZES: Record<PictureSize, { box: string; pad: string; backdrop: string; border: string }> = {
  grid: { box: "w-full rounded-card", pad: "p-[14%]", backdrop: "inset-[9%]", border: "border-2" },
  intro: { box: "size-40 rounded-card", pad: "p-6", backdrop: "inset-3", border: "border-2" },
  avatar: { box: "size-10 rounded-xl", pad: "p-1", backdrop: "inset-0.5", border: "border" },
};

/**
 * A vocabulary picture on a square, rounded surface card. Pictures keep their own colours in both
 * themes; the card background is the `surface` token. When `image.dark` is set (mostly near-black
 * picture, flagged by `npm run images`), a soft light disc sits behind it in dark theme only: the
 * disc is `ink` blended with `mix-blend-screen` over the surface, which is invisible on the light
 * surface and light on the dark one — tokens only, no `dark:` variant.
 */
export function Picture({ image, alt, size = "grid", bordered = true, className }: PictureProps) {
  const s = SIZES[size];
  return (
    <div
      className={cn(
        "relative isolate flex aspect-square shrink-0 items-center justify-center overflow-hidden bg-surface",
        s.box,
        s.pad,
        bordered && cn(s.border, "border-line"),
        className,
      )}
    >
      {image.dark && (
        <span aria-hidden className={cn("absolute rounded-full bg-ink/45 mix-blend-screen", s.backdrop)} />
      )}
      {/* Static export: pictures are small precached SVGs, so a plain <img> (no next/image). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={alt}
        draggable={false}
        decoding="async"
        className="relative size-full select-none object-contain"
      />
    </div>
  );
}
