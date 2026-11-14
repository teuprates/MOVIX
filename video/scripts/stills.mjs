#!/usr/bin/env node
/**
 * Renderiza quadros de conferência (out/stills) para revisar enquadramentos, textos e legendas.
 * Uso: npm run stills            → um quadro a cada 2 s
 *      npm run stills -- 12.5 40 → apenas nos segundos informados
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { browserExecutable } from "./browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out/stills");
mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const browser = browserExecutable();
const composition = await selectComposition({ serveUrl, id: "MovixPitch", browserExecutable: browser });
const args = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
const seconds = args.length ? args : Array.from({ length: Math.floor(composition.durationInFrames / composition.fps / 2) + 1 }, (_, i) => i * 2);
const scale = Number(process.env.STILL_SCALE ?? 0.5);
for (const s of seconds) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(s * composition.fps));
  const file = path.join(out, `t${s.toFixed(1).padStart(5, "0")}.jpg`);
  await renderStill({ composition, serveUrl, output: file, frame, imageFormat: "jpeg", jpegQuality: 88, scale, browserExecutable: browser });
  console.log(file);
}
