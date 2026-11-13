"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type Theme = "system" | "light" | "dark";
const KEY = "movix-theme";

/** Script inline executado antes da pintura para evitar flash de tema incorreto. */
export const themeScript = `(function(){try{var t=localStorage.getItem('${KEY}')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(!r.dataset.forceTheme){r.classList.toggle('dark',d);}}catch(e){}})();`;

function apply(theme: Theme) {
  const root = document.documentElement;
  if (root.dataset.forceTheme) return;
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export function ThemeToggle({ className, variant = "default" }: { className?: string; variant?: "default" | "rail" }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    let stored: Theme = "system";
    try {
      stored = (localStorage.getItem(KEY) as Theme) || "system";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage após hidratação
    setTheme(stored);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply((localStorage.getItem(KEY) as Theme) || "system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {}
    apply(t);
  };

  const options: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: "Tema claro", Icon: Sun },
    { value: "system", label: "Tema do sistema", Icon: Monitor },
    { value: "dark", label: "Tema escuro", Icon: Moon },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn("inline-flex rounded-lg border p-0.5", variant === "rail" ? "border-rail-border bg-rail-2" : "border-border bg-surface-2", className)}
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => choose(value)}
          className={cn(
            "grid size-7 place-items-center rounded-md transition-colors duration-150",
            variant === "rail"
              ? theme === value ? "bg-rail-3 text-white" : "text-rail-muted hover:text-rail-fg"
              : theme === value ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
