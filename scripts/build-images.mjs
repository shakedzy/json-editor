#!/usr/bin/env node
// Rasterize SVGs in ./assets to PNGs the Tauri bundler / README use.
// Runs automatically before `tauri build` via the bundle.macOS.dmg configuration.
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const renders = [
  { from: "assets/dmg-background.svg", to: "assets/dmg-background.png", width: 660 },
  { from: "assets/dmg-background.svg", to: "assets/dmg-background@2x.png", width: 1320 },
  { from: "assets/banner.svg", to: "assets/banner.png", width: 1400 },
];

for (const { from, to, width } of renders) {
  const svg = readFileSync(resolve(from));
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  const png = resvg.render().asPng();
  const out = resolve(to);
  if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, png);
  console.log(`wrote ${to} (${png.length.toLocaleString()} bytes, ${width}px wide)`);
}
