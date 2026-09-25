"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type OrbitHealth = "ok" | "risk" | "failed";
export type OrbitItem = {
  id: string;
  /** seconds until the next charge; negative = overdue */
  secsUntil: number;
  /** only needed in live mode: the billing period, so dots can loop */
  periodSecs?: number;
  lane: number;
  amount: number;
  health: OrbitHealth;
  label?: string;
  detail?: string;
};

const SIZE = 640;
const C = SIZE / 2;
const LANES = [262, 222, 182, 142];
const TICK_R = 292;
const COLORS: Record<OrbitHealth, string> = {
  ok: "var(--color-usdc)",
  risk: "var(--color-amber)",
  failed: "var(--color-coral)",
};

const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};

function angleFor(secsUntil: number, windowSecs: number, graceSecs = 3 * 86400) {
  if (secsUntil >= 0) return -90 + (360 * secsUntil) / windowSecs;
  // overdue: park inside a 16° "due" wedge just before now, deeper = more overdue
  const f = Math.min(1, -secsUntil / graceSecs);
  return -92 - 14 * f;
}

const dotR = (amount: number) => Math.max(3.2, Math.min(9, 2.6 + Math.sqrt(amount) * 0.62));

export function Orbit({
  items,
  lanes,
  windowSecs = 30 * 86400,
  children,
  live,
  entrance = true,
  className = "",
}: {
  items: OrbitItem[];
  lanes: string[];
  windowSecs?: number;
  children?: ReactNode;
  /** simulate time passing: `speed` simulated seconds per real second */
  live?: { speed: number; onCharge?: (item: OrbitItem) => void };
  entrance?: boolean;
  className?: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [pulses, setPulses] = useState<{ key: number; lane: number; color: string }[]>([]);
  const [hover, setHover] = useState<(OrbitItem & { x: number; y: number }) | null>(null);
  const prevT = useRef(new Map<string, number>());
  const onCharge = useRef(live?.onCharge);
  onCharge.current = live?.onCharge;

  // Live mode clock
  useEffect(() => {
    if (!live) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      setElapsed((e) => e + dt * live.speed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live?.speed]); // eslint-disable-line react-hooks/exhaustive-deps

  const placed = useMemo(() => {
    return items
      .map((it) => {
        let t = it.secsUntil;
        if (live && it.periodSecs) {
          const p = it.periodSecs;
          t = (((it.secsUntil - elapsed) % p) + p) % p;
        }
        return { ...it, t };
      })
      .filter((it) => it.t < windowSecs && it.lane < LANES.length)
      .map((it) => {
        const deg = angleFor(it.t, windowSecs);
        const r = LANES[it.lane];
        return { ...it, deg, r, ...polar(r, deg) };
      });
  }, [items, elapsed, live, windowSecs]);

  // Detect wrap-arounds (= a charge happened) in live mode
  useEffect(() => {
    if (!live) return;
    const fired: OrbitItem[] = [];
    for (const it of placed) {
      const prev = prevT.current.get(it.id);
      if (prev !== undefined && prev < windowSecs * 0.05 && it.t > windowSecs * 0.5) fired.push(it);
      prevT.current.set(it.id, it.t);
    }
    if (fired.length) {
      setPulses((ps) => [
        ...ps.slice(-8),
        ...fired.map((f, i) => ({ key: performance.now() + i, lane: f.lane, color: COLORS[f.health] })),
      ]);
      fired.forEach((f) => onCharge.current?.(f));
    }
  }, [placed, live, windowSecs]);

  const ticks = useMemo(() => {
    const days = Math.round(windowSecs / 86400);
    return Array.from({ length: days }, (_, d) => {
      const deg = -90 + (360 * d) / days;
      const major = d % 7 === 0;
      const a = polar(TICK_R - (major ? 10 : 5), deg);
      const b = polar(TICK_R, deg);
      return { d, deg, major, a, b };
    });
  }, [windowSecs]);

  const soonArc = useMemo(() => {
    const span = Math.max(4, (360 * 86400) / windowSecs);
    const r = LANES[0] + 16;
    const r2 = LANES[Math.min(lanes.length, LANES.length) - 1] - 16;
    const a1 = polar(r, -90), a2 = polar(r, -90 + span), b2 = polar(r2, -90 + span), b1 = polar(r2, -90);
    return `M${a1.x},${a1.y} A${r},${r} 0 0 1 ${a2.x},${a2.y} L${b2.x},${b2.y} A${r2},${r2} 0 0 0 ${b1.x},${b1.y} Z`;
  }, [windowSecs, lanes.length]);

  const now = polar(TICK_R + 2, -90);
  const innerEdge = LANES[Math.min(lanes.length, LANES.length) - 1] - 26;

  return (
    <div className={`relative aspect-square w-full select-none ${className}`}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full overflow-visible" role="img"
        aria-label={`Billing orbit: ${placed.length} upcoming charges in the next ${Math.round(windowSecs / 86400)} days`}>
        <defs>
          <radialGradient id="core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#12306a" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#0c1a35" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="soon" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--color-usdc)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--color-usdc)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle cx={C} cy={C} r={LANES[0] + 30} fill="url(#core)" />

        {/* next-24h window */}
        <path d={soonArc} fill="url(#soon)" />

        {/* day ticks */}
        {ticks.map((t) => (
          <line key={t.d} x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y}
            stroke={t.major ? "var(--color-mute)" : "var(--color-line)"} strokeWidth={t.major ? 1.5 : 1} strokeLinecap="round" />
        ))}
        {ticks.filter((t) => t.major && t.d > 0).map((t) => {
          const p = polar(TICK_R + 18, t.deg);
          return (
            <text key={`l${t.d}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              className="fill-dim text-[13px] tabular" style={{ fontFamily: "var(--font-sans)" }}>
              {t.d}d
            </text>
          );
        })}

        {/* lanes */}
        {LANES.slice(0, lanes.length).map((r, i) => {
          const len = 2 * Math.PI * r;
          return (
            <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="var(--color-line)" strokeWidth={1}
              className={entrance ? "ring-draw" : ""}
              style={{ ["--len" as string]: `${len}`, animationDelay: `${i * 120}ms` }}
              transform={`rotate(-90 ${C} ${C})`} />
          );
        })}

        {/* now hand */}
        <line x1={C} y1={C - innerEdge} x2={now.x} y2={now.y} stroke="var(--color-fg)" strokeOpacity={0.55}
          strokeWidth={1} strokeDasharray="2 5" />
        <circle cx={now.x} cy={now.y} r={3.5} fill="var(--color-fg)" />
        <text x={now.x} y={now.y - 14} textAnchor="middle" className="fill-fg text-[13px] font-medium"
          style={{ fontFamily: "var(--font-sans)" }}>
          now
        </text>

        {/* charge pulses (live) */}
        {pulses.map((p) => {
          const at = polar(LANES[p.lane], -90);
          return (
            <circle key={p.key} cx={at.x} cy={at.y} r={4} fill="none" stroke={p.color} strokeWidth={2}
              className="animate-pulse-ring" style={{ animationFillMode: "forwards" }} />
          );
        })}

        {/* subscription dots */}
        {placed.map((it, i) => (
          <g key={it.id}
            onMouseEnter={() => setHover(it)} onMouseLeave={() => setHover((h) => (h?.id === it.id ? null : h))}>
            <circle cx={it.x} cy={it.y} r={dotR(it.amount) + 7} fill="transparent" />
            <circle
              cx={it.x} cy={it.y} r={dotR(it.amount)} fill={COLORS[it.health]}
              fillOpacity={it.health === "ok" ? 0.9 : 1}
              stroke="var(--color-ink)" strokeWidth={1.5}
              className={entrance && !live ? "orbit-dot" : ""}
              style={{
                ["--from-x" as string]: `${C - it.x}px`,
                ["--from-y" as string]: `${C - it.y}px`,
                ["--delay" as string]: `${300 + Math.min(i, 120) * 6}ms`,
              }}
            />
            {hover?.id === it.id && (
              <circle cx={it.x} cy={it.y} r={dotR(it.amount) + 4} fill="none" stroke={COLORS[it.health]} strokeWidth={1.5} />
            )}
          </g>
        ))}
      </svg>

      {/* center content */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="pointer-events-auto flex max-w-[44%] flex-col items-center text-center">{children}</div>
      </div>

      {/* tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl border border-line bg-raise/95 px-3 py-2 text-[13px] shadow-2xl shadow-black/40 backdrop-blur"
          style={{ left: `${(hover.x / SIZE) * 100}%`, top: `${(hover.y / SIZE) * 100}%` }}
        >
          {hover.label && <div className="font-medium text-fg">{hover.label}</div>}
          {hover.detail && <div className="text-mute">{hover.detail}</div>}
        </div>
      )}
    </div>
  );
}

export function OrbitLegend({ lanes }: { lanes: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-mute">
      <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-usdc" />Will charge</span>
      <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-amber" />At risk</span>
      <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-coral" />Overdue</span>
      <span className="text-dim">Orbits from outside in: {lanes.join(", ")}</span>
    </div>
  );
}
