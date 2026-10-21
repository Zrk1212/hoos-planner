"use client";
/**
 * Large weekly calendar for the live plan page. Each course gets its own color; meetings that overlap in time on
 * the same day share the column side by side, conflicts get a red ring, and half-term sections are tagged with
 * their half. Sections with no set meeting time are listed under the grid.
 */
import { DAY_LABEL, fmtTime, quarterOf } from "@/lib/meetings";
import type { Conflict } from "@/lib/meetings";
import type { TermInfo } from "@/lib/catalog-types";
import type { DayCode, Section } from "@/lib/types";

const DAYS: DayCode[] = ["Mo", "Tu", "We", "Th", "Fr"];
const HUES = [221, 24, 158, 276, 340, 192, 45, 120, 300, 0];
const PX_PER_MIN = 0.9;

type Block = { s: Section; i: number; mi: number; start: number; end: number; half: "A" | "B" | null; lane: number; lanes: number };

function layout(blocks: Omit<Block, "lane" | "lanes">[]): Block[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Block[] = [];
  let group: Block[] = [], groupEnd = -1;
  const flush = () => { const n = Math.max(1, ...group.map((b) => b.lane + 1)); for (const b of group) b.lanes = n; out.push(...group); group = []; };
  for (const b of sorted) {
    if (b.start >= groupEnd && group.length) flush();
    const used = new Set(group.filter((g) => g.end > b.start).map((g) => g.lane));
    let lane = 0; while (used.has(lane)) lane++;
    group.push({ ...b, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, b.end);
  }
  if (group.length) flush();
  return out;
}

export function LiveWeek({ cart, term, conflicts, fresh }: { cart: Section[]; term: TermInfo | null; conflicts: Conflict[]; fresh: Set<number> }) {
  const clash = new Set(conflicts.flatMap((c) => [c.a, c.b]));
  const timed = cart.flatMap((s, i) => s.meetings.map((m, mi) => ({ s, i, m, mi })).filter(({ m }) => m.start != null && m.end != null));
  const weekend = cart.filter((s) => s.meetings.some((m) => m.start != null && m.days.some((d) => !DAYS.includes(d))));
  const untimed = cart.filter((s) => !s.meetings.some((m) => m.start != null));
  const t0 = Math.min(8 * 60, ...timed.map((x) => Math.floor(x.m.start! / 60) * 60));
  const t1 = Math.max(17 * 60, ...timed.map((x) => Math.ceil(x.m.end! / 60) * 60));
  const hours = Array.from({ length: (t1 - t0) / 60 + 1 }, (_, k) => t0 + k * 60);
  const H = (t1 - t0) * PX_PER_MIN;

  return (
    <div className="glass !rounded-[22px] p-3 sm:p-4">
      <div className="grid grid-cols-[2.6rem_repeat(5,minmax(0,1fr))] gap-x-1 sm:grid-cols-[3.2rem_repeat(5,minmax(0,1fr))] sm:gap-x-2">
        <div />
        {DAYS.map((d) => <div key={d} className="pb-2 text-center text-xs font-medium text-muted">{DAY_LABEL[d]}</div>)}
        <div className="relative" style={{ height: H }}>
          {hours.map((h) => (
            <div key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted mono" style={{ top: (h - t0) * PX_PER_MIN }}>{fmtTime(h).replace(":00", "")}</div>
          ))}
        </div>
        {DAYS.map((d) => {
          const blocks = layout(timed.filter((x) => x.m.days.includes(d)).map(({ s, i, m, mi }) => {
            const q = quarterOf({ start_dt: m.start_dt, end_dt: m.end_dt }, term);
            return { s, i, mi, start: m.start!, end: m.end!, half: q === "A" || q === "B" ? q : null };
          }));
          return (
            <div key={d} className="relative rounded-xl bg-chip/50" style={{ height: H }}>
              {hours.map((h) => <div key={h} className="absolute inset-x-0 border-t border-line/60" style={{ top: (h - t0) * PX_PER_MIN }} />)}
              {blocks.map((b) => {
                const hue = HUES[b.i % HUES.length];
                const w = 100 / b.lanes;
                return (
                  <div key={`${b.s.class_nbr}-${b.mi}`} title={`${b.s.course} ${fmtTime(b.start)}–${fmtTime(b.end)} #${b.s.class_nbr}`}
                    className={`absolute overflow-hidden rounded-lg border px-1.5 py-1 text-[10px] leading-tight sm:text-[11px] ${fresh.has(b.s.class_nbr) ? "block-arrive" : ""} ${clash.has(b.s.class_nbr) ? "ring-2 ring-bad" : ""}`}
                    style={{
                      top: (b.start - t0) * PX_PER_MIN, height: Math.max(22, (b.end - b.start) * PX_PER_MIN - 2),
                      left: `calc(${b.lane * w}% + 1px)`, width: `calc(${w}% - 2px)`,
                      background: `linear-gradient(180deg, hsl(${hue} 85% 60% / 0.28), hsl(${hue} 85% 55% / 0.18))`,
                      borderColor: `hsl(${hue} 70% 55% / 0.55)`,
                    }}>
                    <div className="break-words font-semibold" style={{ color: `hsl(${hue} 70% 32%)` }}><span className="dark-lift">{b.s.subject} {b.s.catalog_nbr}</span></div>
                    <div className="hidden truncate text-muted sm:block">{fmtTime(b.start)}{b.half ? ` · ${b.half === "A" ? "1st" : "2nd"} half` : ""}</div>
                    {b.half && <div className="text-[9px] font-semibold text-orange-ink sm:hidden">{b.half === "A" ? "1st" : "2nd"} half</div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {weekend.length > 0 && (
        <p className="mt-3 text-xs text-muted">Also meets on the weekend: {weekend.map((s) => `${s.course} #${s.class_nbr}`).join(", ")}</p>
      )}
      {untimed.length > 0 && (
        <p className="mt-3 text-xs text-muted">No set meeting time: {untimed.map((s) => `${s.course} #${s.class_nbr}`).join(", ")}</p>
      )}
    </div>
  );
}
