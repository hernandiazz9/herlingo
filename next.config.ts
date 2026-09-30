import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: `next build` writes plain HTML/CSS/JS to `out/`. No server runtime.
  output: "export",
  // `/repaso` is emitted as `out/repaso/index.html`, which any static host serves.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
