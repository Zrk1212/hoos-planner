"use client";
import Link from "next/link";
import { cartCredits } from "@/lib/search";
import { LiveWeek } from "./LiveWeek";
import { UnknownLine } from "./CartPage";
import { PlanShell, WaitingForClaude } from "./PlanShell";
import type { ActivePlan } from "./useActivePlan";

export function SchedulePage() {
  return (
    <PlanShell title="Your schedule" blurb="Your week as your AI builds it.">
      {(p) => <ScheduleBody p={p} />}
    </PlanShell>
  );
}

export function ScheduleBody({ p }: { p: ActivePlan }) {
        const credits = cartCredits(p.main);
        return (
          <div className="space-y-5">
            {p.row?.notes && (
              <div className="glass !rounded-[22px] p-4 text-[15px] leading-relaxed">
                <div className="label mb-1">From your AI</div>
                <p className="whitespace-pre-wrap">{p.row.notes}</p>
              </div>
            )}
            {p.unknown.length > 0 && <UnknownLine unknown={p.unknown} />}
            {p.main.length === 0 ? (p.backups.length ? (
              <div className="glass !rounded-[22px] p-6 text-center text-sm">
                <p className="font-medium">{p.backups.length} backup{p.backups.length === 1 ? "" : "s"} saved, but no main classes yet.</p>
                <p className="mt-1 text-muted">Backups stay off the week. Ask your AI to add your main classes, or <Link href="/cart" className="underline">see them in the cart</Link>.</p>
              </div>
            ) : <WaitingForClaude />) : (
              <>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="chip !text-xs">{p.main.length} classes</span>
                  <span className={`chip !text-xs ${credits < 12 || credits > 18 ? "text-warn" : ""}`}>{credits} credits</span>
                  <span className={`chip !text-xs ${p.conflicts.length ? "text-bad" : "text-ok"}`}>{p.conflicts.length ? `${p.conflicts.length} conflict${p.conflicts.length === 1 ? "" : "s"}` : "No conflicts"}</span>
                  {p.backups.length > 0 && <span className="chip !text-xs">{p.backups.length} backup{p.backups.length === 1 ? "" : "s"}</span>}
                </div>
                {p.conflicts.length > 0 && (
                  <div className="space-y-0.5 text-sm text-bad">
                    {p.conflicts.slice(0, 3).map((c) => <div key={`${c.a}-${c.b}`}>⚠ {c.reason}</div>)}
                    {p.conflicts.length > 3 && <div>…and {p.conflicts.length - 3} more. Ask your AI to fix the overlaps.</div>}
                  </div>
                )}
                <LiveWeek cart={p.main} term={p.catalog!.term} conflicts={p.conflicts} fresh={p.fresh} />
                <div className="flex flex-wrap gap-3">
                  <Link href="/cart" className="btn">See the full cart</Link>
                  <Link href="/requirements" className="btn">See requirements</Link>
                </div>
              </>
            )}
          </div>
        );
}
