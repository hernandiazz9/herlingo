# Custom pictures

One SVG per drawable word that Fluent Emoji Flat lacks: `<slug>.svg`, referenced from content as
`image: "custom:<slug>"` (slug = vocab id with dots → dashes, e.g. `food.cannolo` →
`food-cannolo.svg`). Language-agnostic: the same drawing serves every pack.

Style guide, checks and commands: docs/content-guide.md, section "Pictures". In short: viewBox
`0 0 32 32`, flat solid fills, rounded shapes, no outlines, no text, Fluent-like palette, centred
with ~2px margin, < 6 KB. `npm run content:check` lints every file here; `npm run images` copies the
referenced ones (minified) to `public/images/custom/`.
