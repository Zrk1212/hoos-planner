/**
 * Wireframe of the Rotunda, front elevation from the Lawn (after a summer photo of the south portico).
 * Shallow dome drawn as a lat/long mesh over three stepped rings, brick drum with its cornice bands and
 * windows, six-column Corinthian portico under a pediment with its round window, lit windows behind the
 * columns, the wide front steps, balustraded terrace wings with their arcades, and a perspective grid for
 * the Lawn. Geometry is computed so lines behind the portico are cut where the portico covers them.
 * Strokes draw in on load (pathLength=1 + dash offset); prefers-reduced-motion shows it finished.
 */
const CX = 400;
const K = 0.05; // how far rings bow toward the viewer: we look at the dome from slightly below
type Pt = [number, number];

const f = (n: number) => Math.round(n * 10) / 10;

// Portico silhouette (pediment + columns + steps); anything behind it is not drawn.
function hidden([x, y]: Pt) {
  const dx = Math.abs(x - CX);
  return dx <= 124 && y >= 145 + dx * (39 / 124) - 1;
}

/** Polyline to path data, split into runs wherever a point falls behind the portico. */
function seg(pts: Pt[], occlude = true) {
  let d = "", pen = false;
  for (const p of pts) {
    if (occlude && hidden(p)) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${f(p[0])} ${f(p[1])}`;
    pen = true;
  }
  return d;
}

const range = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Front half of a horizontal ring of radius r at height y. */
const ring = (y: number, r: number, from = -90, to = 90) =>
  seg(range(from, to, 64).map((t): Pt => [CX + r * Math.sin(rad(t)), y + K * r * Math.cos(rad(t))]));

// dome
const DOME_Y = 133, DOME_R = 150, DOME_H = 84;
const dome = (t: number, p: number): Pt => [
  CX + DOME_R * Math.cos(rad(p)) * Math.sin(rad(t)),
  DOME_Y - DOME_H * Math.sin(rad(p)) + K * DOME_R * Math.cos(rad(p)) * Math.cos(rad(t)),
];
const OCULUS = 84;
const domeOutline = seg(range(0, 180, 60).map((a): Pt => [CX - DOME_R * Math.cos(rad(a)), DOME_Y - DOME_H * Math.sin(rad(a))]), false);
const meridians = range(-75, 75, 10).map((t) => seg(range(0, OCULUS, 24).map((p) => dome(t, p)), false)).join("");
const parallels = [12, 26, 40, 54, 68].map((p) => seg(range(-90, 90, 64).map((t) => dome(t, p)), false)).join("");
const oculusFront = seg(range(-90, 90, 32).map((t) => dome(t, OCULUS)), false);
const oculusBack = seg(range(90, 270, 32).map((t) => dome(t, OCULUS)), false);

// stepped rings at the dome's base, then the drum
const TIERS: [number, number][] = [[133, 152], [137, 156], [140, 160], [144, 164], [147, 168], [151, 168]];
const tiers = TIERS.map(([y, r]) => ring(y, r)).join("");
const tierEnds = [-1, 1].map((s) => TIERS.map(([y, r], i) => `${i ? "L" : "M"}${CX + s * r} ${y}`).join("")).join("");
const DRUM_R = 166;
const drumWalls = `M${CX - DRUM_R} 151 L${CX - DRUM_R} 360 M${CX + DRUM_R} 151 L${CX + DRUM_R} 360`;
const drumBands = [184, 189, 202, 336].map((y) => ring(y, DRUM_R)).join("");

// drum windows, foreshortened on the curve
const drumWindows = [-1, 1].flatMap((s) => {
  const x = CX + s * 141, w = 10;
  return [`M${x - w / 2} 214h${w}v30h${-w}Z`, `M${x - w / 2} 268h${w}v38h${-w}Z`, `M${x - w / 2 - 2} 210h${w + 4}`, `M${x - w / 2 - 2} 264h${w + 4}`];
}).join("");

// portico
const COLS = range(302, 498, 5);
const pediment = "M276 184L400 145L524 184Z";
const pedimentInner = "M298 180L400 151L502 180";
const entablature = "M282 184H518V203H282Z";
const fasciae = "M282 190H518M282 196H518";
const dentils = range(286, 514, 38).map((x) => `M${f(x)} 184v3`).join("");
const capitals = COLS.map((x) => `M${x - 9} 204h18M${x - 9} 204Q${x - 7} 209 ${x - 6} 214M${x + 9} 204Q${x + 7} 209 ${x + 6} 214M${x - 6} 214h12`).join("");
const volutes = COLS.map((x) => `M${x - 6.5} 206.5a1.6 1.6 0 1 0 0.1 0M${x + 6.5} 206.5a1.6 1.6 0 1 0 0.1 0`).join("");
const shafts = COLS.map((x) => `M${x - 6} 214L${x - 7} 326M${x + 6} 214L${x + 7} 326`).join("");
const flutes = COLS.map((x) => `M${x - 2} 216L${x - 2.4} 325M${x + 2} 216L${x + 2.4} 325`).join("");
const bases = COLS.map((x) => `M${x - 9} 326h18M${x - 10} 330h20M${x - 10} 336h20M${x - 10} 330v6M${x + 10} 330v6`).join("");
const BAYS = range(321.6, 478.4, 4);
const bayWin = BAYS.filter((_, i) => i !== 2);
const facadeUpper = bayWin.map((x) => `M${x - 6} 224h12v26h-12Z`).join("");
const facadeLower = bayWin.map((x) => `M${x - 7} 272h14v40h-14ZM${x - 9} 268h18`).join("");
const door = "M391 336V292Q400 280 409 292V336M387 286h26";
const stylobate = "M280 336H520";
const steps = range(1, 6, 5).map((i) => `M${280 - 7 * i} ${336 + 4 * i}H${520 + 7 * i}`).join("");
const cheeks = "M280 336L238 360M520 336L562 360";

// terrace wings: balustrade over an arcade
const wing = (s: -1 | 1) => {
  const inner = CX + s * DRUM_R, outer = CX + s * 400;
  const xs = (a: number, b: number, step: number) => { const out: number[] = []; for (let x = Math.min(a, b); x <= Math.max(a, b); x += step) out.push(x); return out; };
  const [lo, hi] = [Math.min(inner, outer), Math.max(inner, outer)];
  const rails = `M${lo} 290H${hi}M${lo} 294H${hi}M${lo} 312H${hi}M${lo} 316H${hi}M${lo} 360H${hi}`;
  const balusters = xs(lo + 4, hi - 4, 6).map((x) => `M${x} 295V311`).join("");
  const piers = xs(lo + 2, hi - 10, 44).map((x) => `M${x} 288h8v28h-8Z`).join("");
  const arches = xs(lo + 10, hi - 22, 28).map((x) => `M${x} 360V336A8 8 0 0 1 ${x + 16} 336V360`).join("");
  return { rails, balusters, piers, arches };
};
const L = wing(-1), R = wing(1);

// Lawn: perspective grid toward a vanishing point above the steps
const VP: Pt = [CX, 250];
const lawnRows = [5, 11, 18, 27, 38, 52, 70].map((d) => `M0 ${360 + d}H800`).join("");
const lawnRays = range(-1400, 2200, 36).map((xb) => {
  const yb = 440, t = (360 - VP[1]) / (yb - VP[1]);
  return `M${f(VP[0] + (xb - VP[0]) * t)} 360L${xb} ${yb}`;
}).join("");

const d = (i: number) => ({ animationDelay: `${0.1 + i * 0.12}s` });

export function Rotunda({ className = "" }: { className?: string }) {
  let n = 0;
  return (
    <svg viewBox="0 0 800 440" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <defs>
        <radialGradient id="rot-oculus" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd9a8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#e57200" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rot-edge" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.16" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.84" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rot-lawn" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0.82" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="rot-fade-x"><rect width="800" height="440" fill="url(#rot-edge)" /></mask>
        <mask id="rot-fade-y"><rect width="800" height="440" fill="url(#rot-lawn)" /></mask>
      </defs>

      {/* oculus glow and lit windows, once the lines have drawn */}
      <ellipse cx={CX} cy={DOME_Y - DOME_H + 2} rx="46" ry="26" fill="url(#rot-oculus)" stroke="none" className="fade-late" style={{ animationDelay: "2.8s" }} />
      <g fill="#ffb867" stroke="none" className="fade-late window-glow" style={{ animationDelay: "3s" }}>
        <path d={facadeUpper} opacity="0.32" />
        <path d={bayWin.map((x) => `M${x - 7} 272h14v40h-14Z`).join("")} opacity="0.42" />
        <path d="M391 336V292Q400 280 409 292V336Z" opacity="0.55" />
        <path d={drumWindows.split("M").filter((s) => s.endsWith("Z")).map((s) => "M" + s).join("")} opacity="0.28" />
      </g>

      <g mask="url(#rot-fade-y)">
        <g mask="url(#rot-fade-x)">
          {/* Lawn */}
          <g strokeWidth="0.7" strokeOpacity="0.22">
            <path pathLength={1} className="draw" style={d(n++)} d={lawnRows} />
            <path pathLength={1} className="draw" style={d(n++)} d={lawnRays} />
          </g>
          {/* terrace wings */}
          <g strokeWidth="1">
            <path pathLength={1} className="draw" style={d(n++)} d={L.rails + R.rails} strokeOpacity="0.8" />
            <path pathLength={1} className="draw" style={d(n++)} d={L.piers + R.piers} strokeOpacity="0.7" />
            <path pathLength={1} className="draw" style={d(n++)} d={L.arches + R.arches} strokeOpacity="0.55" />
            <path pathLength={1} className="draw" style={d(n++)} d={L.balusters + R.balusters} strokeOpacity="0.4" strokeWidth="0.7" />
          </g>
        </g>
      </g>

      {/* dome mesh */}
      <g strokeWidth="1.4">
        <path pathLength={1} className="draw" style={d(n++)} d={domeOutline} />
        <path pathLength={1} className="draw" style={d(n++)} d={parallels} strokeOpacity="0.55" strokeWidth="0.9" />
        <path pathLength={1} className="draw" style={d(n++)} d={meridians} strokeOpacity="0.45" strokeWidth="0.8" />
        <path pathLength={1} className="draw" style={d(n++)} d={oculusFront} />
        <path pathLength={1} className="draw" style={d(n++)} d={oculusBack} strokeOpacity="0.4" />
      </g>

      {/* stepped rings and drum */}
      <g strokeWidth="1.2">
        <path pathLength={1} className="draw" style={d(n++)} d={tiers + tierEnds} />
        <path pathLength={1} className="draw" style={d(n++)} d={drumWalls + drumBands} />
        <path pathLength={1} className="draw" style={d(n++)} d={drumWindows} strokeOpacity="0.8" />
      </g>

      {/* portico */}
      <g strokeWidth="1.3">
        <path pathLength={1} className="draw" style={d(n++)} d={pediment} />
        <path pathLength={1} className="draw" style={d(n++)} d={pedimentInner} strokeOpacity="0.55" />
        <circle pathLength={1} className="draw" style={d(n)} cx={CX} cy="170" r="6.5" />
        <circle pathLength={1} className="draw" style={d(n++)} cx={CX} cy="170" r="3.5" strokeOpacity="0.6" />
        <path pathLength={1} className="draw" style={d(n++)} d={entablature + fasciae} />
        <path pathLength={1} className="draw" style={d(n++)} d={dentils} strokeOpacity="0.5" strokeWidth="0.8" />
        <path pathLength={1} className="draw" style={d(n++)} d={facadeUpper + facadeLower + door} strokeOpacity="0.55" strokeWidth="0.9" />
        <path pathLength={1} className="draw" style={d(n++)} d={shafts} />
        <path pathLength={1} className="draw" style={d(n++)} d={flutes} strokeOpacity="0.35" strokeWidth="0.6" />
        <path pathLength={1} className="draw" style={d(n++)} d={capitals + volutes} strokeWidth="1" />
        <path pathLength={1} className="draw" style={d(n++)} d={bases + stylobate} strokeWidth="1" />
        <path pathLength={1} className="draw" style={d(n++)} d={steps + cheeks} strokeOpacity="0.85" />
      </g>
    </svg>
  );
}
