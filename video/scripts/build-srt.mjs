#!/usr/bin/env node
/** Gera out/movix-pitch.srt a partir das mesmas legendas usadas no vídeo (src/data/timeline.json). */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { captions } = JSON.parse(readFileSync(path.join(root, "src/data/timeline.json"), "utf8"));
const stamp = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const srt = captions.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join("\n");
mkdirSync(path.join(root, "out"), { recursive: true });
writeFileSync(path.join(root, "out/movix-pitch.srt"), srt, "utf8");
console.log(`out/movix-pitch.srt · ${captions.length} legendas`);
