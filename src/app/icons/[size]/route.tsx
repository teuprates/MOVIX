import { ImageResponse } from "next/og";

const SIZES: Record<string, { px: number; pad: number }> = {
  "180": { px: 180, pad: 0.2 },
  "192": { px: 192, pad: 0.2 },
  "512": { px: 512, pad: 0.2 },
  maskable: { px: 512, pad: 0.3 },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size } = await ctx.params;
  const conf = SIZES[size] ?? SIZES["192"];
  const inner = Math.round(conf.px * (1 - conf.pad * 2));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 30% 20%, #0f1d45 0%, #05070d 70%)",
        }}
      >
        <svg width={inner} height={Math.round(inner * 0.69)} viewBox="0 0 64 44">
          <defs>
            <linearGradient id="a" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#1E5BFF" />
              <stop offset="0.55" stopColor="#2F8CFF" />
              <stop offset="1" stopColor="#4FA6FF" />
            </linearGradient>
          </defs>
          <path d="M6 37 L21 9 Q23.5 5 26 9 L33 22 L42 8.5 Q44 5.5 47.5 6 L52 6" fill="none" stroke="url(#a)" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="48" y="6" width="9.5" height="31.5" rx="2.6" fill="#1E5BFF" />
        </svg>
      </div>
    ),
    { width: conf.px, height: conf.px },
  );
}
