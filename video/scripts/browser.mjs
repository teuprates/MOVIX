import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Navegador usado pelo Remotion. Por padrão o Remotion baixa o próprio Chrome Headless Shell.
 * Em ambientes sem acesso a esse download, aponte REMOTION_BROWSER_EXECUTABLE para um chrome-headless-shell
 * (ex.: o instalado pelo Playwright), ou deixe a detecção automática abaixo encontrá-lo.
 */
export function browserExecutable() {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return process.env.REMOTION_BROWSER_EXECUTABLE;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(base)) return null;
  const dir = readdirSync(base).filter((d) => d.startsWith("chromium_headless_shell-")).sort().pop();
  if (!dir) return null;
  const bin = path.join(base, dir, "chrome-headless-shell-linux64", "chrome-headless-shell");
  return existsSync(bin) ? bin : null;
}
