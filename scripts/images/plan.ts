/**
 * Picture plan shared by `npm run images` (generate.ts) and `content:check` (scripts/content.ts).
 *
 * Content refers to pictures by key (vocab `image`, dialogue `avatars`):
 *   fluent:<icon>   Microsoft Fluent Emoji Flat (MIT), read at build time from the devDependency
 *                   @iconify-json/fluent-emoji-flat — never fetched at runtime.
 *   custom:<slug>   our own drawing, source in assets/images/custom/<slug>.svg (language-agnostic).
 *
 * `npm run images` writes every referenced picture, minified, to public/images/<source>/<name>.svg
 * (committed, precached by the service worker). A picture that is mostly near-black carries
 * `data-backdrop="dark"` on its root <svg>; `content:build` reads that marker and exposes
 * `image.dark`, so `<Picture>` adds a soft light backdrop in dark theme. There is no manifest:
 * the files themselves are the source of truth (parallel tasks never conflict on one file).
 *
 * Kept free of `@/lib/content` (which needs the generated bundle) and of native modules (the dark
 * detection with resvg lives in generate.ts), so `content:check` stays fast.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { imageFile, parseImageKey } from "../../src/lib/content/keys";
import type { ImageRef, Pack } from "../../src/lib/content/types";

export const PUBLIC_IMAGES = join("public", "images");
export const CUSTOM_SOURCES = join("assets", "images", "custom");
/** Manual dark-backdrop overrides: `{ "dark": [keys], "light": [keys] }` (both optional). */
export const BACKDROP_OVERRIDES = join("assets", "images", "backdrop.json");
/** Style guide limit for custom drawings (bytes, after minification). */
export const CUSTOM_MAX_BYTES = 6 * 1024;
/** Marker on the root <svg> of a near-black picture. */
export const DARK_ATTR = 'data-backdrop="dark"';

const FLUENT_JSON = join("node_modules", "@iconify-json", "fluent-emoji-flat", "icons.json");
const SVG_NS = "http://www.w3.org/2000/svg";

// ---------------------------------------------------------------------------------------------
// Referenced keys
// ---------------------------------------------------------------------------------------------

/** Every picture key the pack references → where it is used (vocab ids, `<dialogue>/<name>`). */
export function referencedImages(pack: Pack): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (key: string | undefined, by: string) => {
    if (!key) return;
    out.set(key, [...(out.get(key) ?? []), by]);
  };
  for (const v of pack.vocab) add(v.imageKey, v.id);
  for (const d of pack.dialogues) for (const [name, key] of Object.entries(d.avatars ?? {})) add(key, `${d.id}/${name}`);
  return new Map([...out].sort(([a], [b]) => a.localeCompare(b)));
}

// ---------------------------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------------------------

interface IconifyIcon {
  body: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}
interface IconifySet {
  width?: number;
  height?: number;
  icons: Record<string, IconifyIcon>;
  aliases?: Record<string, { parent: string; hFlip?: boolean; vFlip?: boolean }>;
}

let fluentCache: { root: string; set: IconifySet } | undefined;

function fluentSet(root: string): IconifySet {
  if (fluentCache?.root !== root) {
    const path = join(root, FLUENT_JSON);
    if (!existsSync(path)) throw new Error(`${FLUENT_JSON} not found: run \`npm ci\``);
    fluentCache = { root, set: JSON.parse(readFileSync(path, "utf8")) as IconifySet };
  }
  return fluentCache.set;
}

export function fluentExists(root: string, name: string): boolean {
  const set = fluentSet(root);
  return name in set.icons || name in (set.aliases ?? {});
}

/** Standalone SVG of a Fluent Emoji Flat icon (aliases and flips resolved), or null if unknown. */
export function fluentSvg(root: string, name: string): string | null {
  const set = fluentSet(root);
  let icon = set.icons[name];
  let hFlip = false;
  let vFlip = false;
  const alias = set.aliases?.[name];
  if (!icon && alias) {
    icon = set.icons[alias.parent];
    hFlip = !!alias.hFlip;
    vFlip = !!alias.vFlip;
  }
  if (!icon) return null;
  const w = icon.width ?? set.width ?? 32;
  const h = icon.height ?? set.height ?? 32;
  const x = icon.left ?? 0;
  const y = icon.top ?? 0;
  let body = icon.body;
  if (hFlip || vFlip) {
    const sx = hFlip ? -1 : 1;
    const sy = vFlip ? -1 : 1;
    body = `<g transform="matrix(${sx} 0 0 ${sy} ${hFlip ? 2 * x + w : 0} ${vFlip ? 2 * y + h : 0})">${body}</g>`;
  }
  return `<svg xmlns="${SVG_NS}" viewBox="${x} ${y} ${w} ${h}">${body}</svg>`;
}

/**
 * Deterministic, dependency-free SVG minifier for hand-written drawings: drops the XML prolog,
 * doctype, comments, <metadata>/<title>/<desc>, editor (inkscape/sodipodi) markup, whitespace
 * between tags, and makes sure the root has the SVG namespace (required by <img>).
 */
export function minifySvg(svg: string): string {
  let s = svg
    .replace(/^﻿/, "")
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(metadata|title|desc)\b[\s\S]*?<\/\1>/g, "")
    .replace(/<(sodipodi|inkscape):[\w-]+\b[\s\S]*?(\/>|<\/\1:[\w-]+>)/g, "")
    .replace(/\s+(?:sodipodi|inkscape):[\w-]+="[^"]*"/g, "")
    .replace(/\s+xmlns:(?:sodipodi|inkscape|xlink|svg)="[^"]*"/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .replace(/\s*(\/?>)/g, "$1")
    .trim();
  s = s.replace(/^<svg\b([^>]*)>/, (_m, attrs: string) => {
    const a = attrs.replace(/\s+data-backdrop="[^"]*"/g, "");
    return a.includes("xmlns=") ? `<svg${a}>` : `<svg xmlns="${SVG_NS}"${a}>`;
  });
  return s;
}

/** Minified custom drawing, or null when `assets/images/custom/<slug>.svg` does not exist yet. */
export function customSvg(root: string, slug: string): string | null {
  const path = join(root, CUSTOM_SOURCES, `${slug}.svg`);
  return existsSync(path) ? minifySvg(readFileSync(path, "utf8")) : null;
}

/** The SVG a key should produce (without the dark marker), or null when there is no source. */
export function sourceSvg(root: string, key: string): string | null {
  const k = parseImageKey(key);
  if (!k) return null;
  return k.source === "fluent" ? fluentSvg(root, k.name) : customSvg(root, k.name);
}

/** Adds or removes the dark-backdrop marker on the root element. */
export function withDarkMarker(svg: string, dark: boolean): string {
  const clean = svg.replace(/^<svg\b([^>]*)>/, (_m, attrs: string) => `<svg${attrs.replace(/\s+data-backdrop="[^"]*"/g, "")}>`);
  return dark ? clean.replace(/^<svg\b/, `<svg ${DARK_ATTR}`) : clean;
}

export function readBackdropOverrides(root: string): { dark: Set<string>; light: Set<string> } {
  const path = join(root, BACKDROP_OVERRIDES);
  if (!existsSync(path)) return { dark: new Set(), light: new Set() };
  const raw = JSON.parse(readFileSync(path, "utf8")) as { dark?: string[]; light?: string[] };
  return { dark: new Set(raw.dark ?? []), light: new Set(raw.light ?? []) };
}

// ---------------------------------------------------------------------------------------------
// Runtime resolution (content:build)
// ---------------------------------------------------------------------------------------------

/**
 * Resolver for `buildPack({ resolveImage })`: a key resolves only when its file exists in
 * public/images/ (missing = no image, never a broken <img>). `dark` comes from the file marker.
 */
export function imageResolver(root: string): (key: string) => ImageRef | undefined {
  const cache = new Map<string, ImageRef | undefined>();
  return (key) => {
    if (cache.has(key)) return cache.get(key);
    const file = imageFile(key);
    const path = file ? join(root, PUBLIC_IMAGES, file) : null;
    let ref: ImageRef | undefined;
    if (file && path && existsSync(path)) {
      const head = readFileSync(path, "utf8").slice(0, 300);
      ref = { src: `/images/${file}`, ...(head.includes(DARK_ATTR) ? { dark: true } : {}) };
    }
    cache.set(key, ref);
    return ref;
  };
}

// ---------------------------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------------------------

/** Style checks for one custom source: errors (unusable file) and warnings (style guide misses). */
export function lintCustomSvg(name: string, raw: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const where = `${CUSTOM_SOURCES}/${name}`;
  const svg = minifySvg(raw);
  if (!/^<svg\b[^>]*>[\s\S]*<\/svg>$/.test(svg)) errors.push(`${where}: not a single <svg>…</svg> document`);
  if (/<script\b|\son\w+=/i.test(svg)) errors.push(`${where}: scripts / event handlers are not allowed`);
  const viewBox = /^<svg\b[^>]*\sviewBox="([^"]*)"/.exec(svg)?.[1];
  if (viewBox?.trim().split(/[\s,]+/).join(" ") !== "0 0 32 32") warnings.push(`${where}: viewBox should be "0 0 32 32" (is ${viewBox ? `"${viewBox}"` : "missing"})`);
  if (/<text\b/.test(svg)) warnings.push(`${where}: contains <text> (pictures have no text)`);
  if (/<image\b/.test(svg)) warnings.push(`${where}: embeds a raster <image> (draw flat vector shapes)`);
  const bytes = Buffer.byteLength(svg);
  if (bytes > CUSTOM_MAX_BYTES) warnings.push(`${where}: ${(bytes / 1024).toFixed(1)} KB after minification (limit 6 KB)`);
  return { errors, warnings };
}

/**
 * Normal `content:check` picture checks: errors for unknown Fluent icons and broken custom
 * sources; warnings for referenced custom drawings that do not exist yet and style-guide misses
 * in any file of assets/images/custom/ (referenced or not, so drawing tasks get feedback early).
 * Malformed keys are already schema errors.
 */
export function checkImageKeys(pack: Pack, root: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const [key, usedBy] of referencedImages(pack)) {
    const k = parseImageKey(key);
    if (!k) continue;
    const by = usedBy.slice(0, 3).join(", ") + (usedBy.length > 3 ? "…" : "");
    if (k.source === "fluent" && !fluentExists(root, k.name)) {
      errors.push(`image "${key}" (${by}): unknown Fluent Emoji Flat icon (names: node_modules/@iconify-json/fluent-emoji-flat/icons.json)`);
    }
    if (k.source === "custom" && !existsSync(join(root, CUSTOM_SOURCES, `${k.name}.svg`))) {
      warnings.push(`image "${key}" (${by}): no drawing yet in ${CUSTOM_SOURCES}/${k.name}.svg (shown without picture)`);
    }
  }
  const dir = join(root, CUSTOM_SOURCES);
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".svg")).sort()) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.svg$/.test(f)) {
        errors.push(`${CUSTOM_SOURCES}/${f}: file name must be <slug>.svg (lowercase a-z0-9 joined by single "-")`);
      }
      const r = lintCustomSvg(f, readFileSync(join(dir, f), "utf8"));
      errors.push(...r.errors);
      warnings.push(...r.warnings);
    }
  }
  return { errors, warnings };
}

/**
 * `content:check --strict-images`: errors for every referenced picture missing from
 * public/images/ or out of date with its source, and for files there that nothing references.
 */
export function checkImages(pack: Pack, root: string): string[] {
  const errors: string[] = [];
  const wanted = new Set<string>();
  for (const [key, usedBy] of referencedImages(pack)) {
    const file = imageFile(key);
    if (!file) continue;
    wanted.add(file);
    const by = usedBy.slice(0, 3).join(", ") + (usedBy.length > 3 ? "…" : "");
    const path = join(root, PUBLIC_IMAGES, file);
    const expected = sourceSvg(root, key);
    if (!expected) {
      // Unknown Fluent icons are already reported by checkImageKeys().
      if (key.startsWith("custom:")) errors.push(`image "${key}" (${by}): no drawing in ${CUSTOM_SOURCES}/${file.slice("custom/".length)}`);
    } else if (!existsSync(path)) errors.push(`image "${key}" (${by}): missing ${PUBLIC_IMAGES}/${file}`);
    else if (withDarkMarker(readFileSync(path, "utf8"), false) !== expected) errors.push(`image "${key}": ${PUBLIC_IMAGES}/${file} is stale`);
  }
  for (const source of ["fluent", "custom"]) {
    const dir = join(root, PUBLIC_IMAGES, source);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!wanted.has(`${source}/${f}`)) errors.push(`${PUBLIC_IMAGES}/${source}/${f}: not referenced by any content`);
    }
  }
  if (errors.length) errors.push(`${errors.length} picture problem(s): run \`npm run images\``);
  return errors;
}
