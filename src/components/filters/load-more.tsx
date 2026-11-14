import Link from "next/link";
import type { SP } from "@/lib/filters";

/** "Carregar mais" por URL (?mais=n): o servidor busca n lotes; o link preserva filtros e posição de rolagem. */
export function LoadMore({ sp, pages, shown, total, path }: { sp: SP; pages: number; shown: number; total: number; path: string }) {
  if (shown >= total) return null;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "mais") p.set(k, v);
  p.set("mais", String(pages + 1));
  return (
    <div className="flex justify-center border-t border-border p-3">
      <Link href={`${path}?${p.toString()}`} scroll={false} className="inline-flex h-11 items-center rounded-lg px-4 text-sm font-medium text-primary hover:bg-primary-soft sm:h-9">
        Carregar mais ({total - shown} restante{total - shown > 1 ? "s" : ""})
      </Link>
    </div>
  );
}
