#!/usr/bin/env node
/**
 * Renderiza o vídeo e normaliza o áudio.
 *   npm run render:preview → out/movix-pitch-preview.mp4 (960×540, rápido, para validação)
 *   npm run render         → out/movix-pitch.mp4 (1920×1080, H.264, AAC) + out/movix-pitch.srt
 * O áudio final passa por loudnorm em duas passagens: −16 LUFS integrados, pico real ≤ −2 dBTP.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browserExecutable } from "./browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] === "preview" ? "preview" : "final";
const silent = process.argv[2] === "sem-narracao"; // só trilha + legendas
const tmp = path.join(root, "out/.tmp");
mkdirSync(tmp, { recursive: true });
const raw = path.join(tmp, `${mode}.mp4`);
const out = path.join(root, "out", silent ? "movix-pitch-sem-narracao.mp4" : mode === "preview" ? "movix-pitch-preview.mp4" : "movix-pitch.mp4");

const args = ["remotion", "render", "src/index.ts", silent ? "MovixPitchSemNarracao" : "MovixPitch", raw, "--codec=h264", "--pixel-format=yuv420p", "--audio-codec=aac", "--audio-bitrate=320k", "--log=error"];
args.push(...(mode === "preview" ? ["--scale=0.5", "--crf=27", "--jpeg-quality=80"] : ["--crf=16", "--jpeg-quality=96"]));
const browser = browserExecutable();
if (browser) args.push(`--browser-executable=${browser}`);
console.log(`Renderizando (${mode})…`);
const r = spawnSync("npx", args, { cwd: root, stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);

const TARGET = "I=-16:TP=-2:LRA=11";
const pass1 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", raw, "-af", `loudnorm=${TARGET}:print_format=json`, "-vn", "-f", "null", "-"], { encoding: "utf8" });
const m = JSON.parse(pass1.stderr.slice(pass1.stderr.lastIndexOf("{"), pass1.stderr.lastIndexOf("}") + 1));
console.log(`Áudio medido: ${m.input_i} LUFS, pico ${m.input_tp} dBTP → alvo −16 LUFS`);
const filter = `loudnorm=${TARGET}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-c:v", "copy", "-af", filter, "-ar", "48000", "-c:a", "aac", "-b:a", mode === "preview" ? "160k" : "256k", "-movflags", "+faststart", out], { stdio: "inherit" });
rmSync(raw, { force: true });
if (mode === "final") execFileSync("node", [path.join(root, "scripts/build-srt.mjs")], { stdio: "inherit" });
console.log(`Pronto: ${path.relative(root, out)}`);
