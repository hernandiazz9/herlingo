/**
 * Near-black detection for the dark-theme backdrop (used by `npm run images`). Renders the SVG with
 * resvg (devDependency, native prebuilt) and measures the painted area, so overlapping shapes
 * count as they look. Separate module so content:check never loads the native renderer.
 */
import { Resvg } from "@resvg/resvg-js";

/** Relative luminance (WCAG) of an sRGB pixel, 0 = black, 1 = white. */
function luminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Pixels darker than this count as near-black (≈ #4a4a4a); dark surfaces are ≈ 0.02. */
const DARK_LUMINANCE = 0.07;
/**
 * Share of the painted area that must be near-black to need a backdrop. Tuned on Fluent Flat,
 * whose "black" is a dark purple (#321b41 / #533566): top-hat, black-heart, movie-camera → dark;
 * mobile-phone, camera, black-cat (colourful or lighter parts) → no backdrop.
 */
const DARK_SHARE = 0.6;

/** True when at least 60 % of the painted pixels are near-black (unreadable on a dark card). */
export function isMostlyDark(svg: string): boolean {
  const img = new Resvg(svg, { fitTo: { mode: "width", value: 64 }, background: "rgba(0,0,0,0)" }).render();
  const px = img.pixels;
  let painted = 0;
  let dark = 0;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a < 128) continue;
    painted++;
    if (luminance(px[i], px[i + 1], px[i + 2]) < DARK_LUMINANCE) dark++;
  }
  return painted > 0 && dark / painted >= DARK_SHARE;
}
