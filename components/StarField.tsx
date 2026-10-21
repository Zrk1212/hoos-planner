"use client";
import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Night sky for the hero: three depths of stars (seeded, so server and client render the same field),
 * a faint Milky Way band with its own dense dust of stars, a few bright stars with glints, and two
 * shooting stars on long loops. Layers drift a few pixels with the pointer; reduced motion keeps it still.
 */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = { x: number; y: number; r: number; o: number; tw?: number };
const W = 1600, H = 900;

function field(seed: number, n: number, rMin: number, rMax: number, twinkleShare: number): Star[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const y = Math.pow(r(), 1.35) * H * 0.92; // denser toward the top, thinning to the horizon glow
    return { x: r() * W, y, r: rMin + r() * (rMax - rMin), o: 0.35 + r() * 0.65, tw: r() < twinkleShare ? r() * 6 : undefined };
  });
}

// Milky Way: stars scattered around a line from upper left to the right horizon
function band(seed: number, n: number): Star[] {
  const r = rng(seed);
  const gauss = () => (r() + r() + r() - 1.5) / 1.5;
  return Array.from({ length: n }, () => {
    const t = r();
    const x = t * W, y = 60 + t * 420 + gauss() * 70;
    return { x, y, r: 0.35 + r() * 0.6, o: 0.25 + r() * 0.5 };
  });
}

const FAR = field(7, 260, 0.35, 0.8, 0.08);
const MID = field(19, 90, 0.8, 1.3, 0.35);
const DUST = band(31, 320);
const BRIGHT = field(53, 12, 1.5, 2.1, 1).map((s) => ({ ...s, y: s.y * 0.75 }));

const dot = (s: Star, i: number, cls = "") => (
  <circle key={i} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} opacity={s.o.toFixed(2)}
    className={s.tw !== undefined ? `twinkle ${cls}` : cls} style={s.tw !== undefined ? { animationDelay: `${s.tw.toFixed(2)}s`, animationDuration: `${(3 + (i % 5)).toFixed(0)}s` } : undefined} />
);

export function StarField() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = root.current;
    if (!el || reduced || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0, x = 0, y = 0;
    const onMove = (e: PointerEvent) => {
      x = e.clientX / window.innerWidth - 0.5;
      y = e.clientY / window.innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.style.setProperty("--px", x.toFixed(3)); el.style.setProperty("--py", y.toFixed(3)); });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, [reduced]);

  const layer = (depth: number) => ({ transform: `translate3d(calc(var(--px, 0) * ${depth}px), calc(var(--py, 0) * ${depth}px), 0)` });
  return (
    <div ref={root} aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="milky absolute inset-0" style={layer(-6)} />
      <svg className="absolute inset-[-12px] h-[calc(100%+24px)] w-[calc(100%+24px)] transition-transform duration-700 ease-out" style={layer(-8)} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" fill="#fff">
        {FAR.map((s, i) => dot(s, i))}
        {DUST.map((s, i) => dot(s, i))}
      </svg>
      <svg className="absolute inset-[-24px] h-[calc(100%+48px)] w-[calc(100%+48px)] transition-transform duration-700 ease-out" style={layer(-18)} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" fill="#fff">
        {MID.map((s, i) => dot(s, i))}
        {BRIGHT.map((s, i) => (
          <g key={i} transform={`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`} className="twinkle" style={{ animationDelay: `${(i * 0.7).toFixed(1)}s`, animationDuration: "5s" }}>
            <circle r={s.r * 4} fill="#cfe0ff" opacity="0.12" />
            <path d={`M${-s.r * 5} 0H${s.r * 5}M0 ${-s.r * 5}V${s.r * 5}`} stroke="#fff" strokeWidth="0.5" strokeOpacity="0.55" />
            <circle r={s.r} />
          </g>
        ))}
      </svg>
      <span className="shooting-star" style={{ top: "14%", left: "62%", animationDelay: "4s" }} />
      <span className="shooting-star" style={{ top: "6%", left: "28%", animationDelay: "13s", animationDuration: "19s" }} />
    </div>
  );
}
