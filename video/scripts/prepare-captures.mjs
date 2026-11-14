#!/usr/bin/env node
/**
 * Copia as capturas REAIS do produto (docs/capturas, geradas por scripts/capturas.mjs com as contas sintéticas do seed)
 * para public/captures. As de desktop (1440 px) são ampliadas 2x com Lanczos para manter a nitidez nos zooms;
 * as de celular (Pixel 7, 1082 px) entram como estão. Também copia a marca e as fontes (Inter/Sora, OFL).
 * Uso: npm run assets   (requer ffmpeg)
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(root, "..");
const src = (...p) => path.join(repo, "docs/capturas", ...p);
const out = (...p) => path.join(root, "public", ...p);
for (const d of ["captures/desktop", "captures/mobile", "brand", "fonts"]) mkdirSync(out(d), { recursive: true });

const desktop = { painel: "proprietario-painel", frota: "proprietario-frota", contratos: "proprietario-contratos", financeiro: "proprietario-financeiro" };
for (const [name, file] of Object.entries(desktop)) {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src("depois", `${file}-desktop-escuro.png`), "-vf", "scale=iw*2:ih*2:flags=lanczos,unsharp=5:5:0.5", out("captures/desktop", `${name}.png`)]);
  console.log(`desktop/${name}.png (2x)`);
}
const mobile = { "owner-painel": "proprietario-painel", "owner-frota": "proprietario-frota", "owner-contratos": "proprietario-contratos", "owner-financeiro": "proprietario-financeiro", "renter-inicio": "locatario-inicio", "renter-pagamentos": "locatario-pagamentos" };
for (const [name, file] of Object.entries(mobile)) {
  copyFileSync(src("pwa", `${file}-escuro.png`), out("captures/mobile", `${name}.png`));
  console.log(`mobile/${name}.png`);
}
copyFileSync(path.join(repo, "public/icon.svg"), out("brand", "icon.svg"));
const fonts = [["inter", 400], ["inter", 500], ["inter", 600], ["inter", 700], ["sora", 500], ["sora", 600], ["sora", 700]];
for (const [family, weight] of fonts) {
  copyFileSync(path.join(root, `node_modules/@fontsource/${family}/files/${family}-latin-${weight}-normal.woff2`), out("fonts", `${family}-${weight}.woff2`));
}
console.log("brand/icon.svg · fonts/*.woff2");
