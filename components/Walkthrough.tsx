"use client";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ConnectorStep, MockWindow, Num, PromptStep } from "./Setup";
import { usePhases } from "./usePrefersReducedMotion";

export const WALKTHROUGH_EVENT = "hp:open-walkthrough";
const STORAGE_KEY = "hp:walkthrough:v2";
const AUTO_OPEN_MS = 25_000;
const TICK_MS = 1000;
const BUSY_PAGES = /^\/(schedule|cart|requirements|plan|login|p)(\/|$)/;

/** Opens the walkthrough from anywhere (nav, hero CTA) without importing its state. */
export function openWalkthrough() { window.dispatchEvent(new CustomEvent(WALKTHROUGH_EVENT)); }

function seen(): boolean { try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return true; } }
function markSeen() { try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch { /* storage unavailable */ } }

const STEPS = ["Connect Hoos Planner", "Paste your first message", "Watch your schedule build"] as const;

export function Walkthrough() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const show = useCallback(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setStep(0);
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    markSeen();
    setOpen(false);
    requestAnimationFrame(() => returnFocus.current?.focus?.());
  }, []);

  useEffect(() => {
    window.addEventListener(WALKTHROUGH_EVENT, show);
    return () => window.removeEventListener(WALKTHROUGH_EVENT, show);
  }, [show]);

  // First visit: let people look around before offering setup. Opens after AUTO_OPEN_MS of time with the tab
  // visible (it keeps counting across pages), but never over the builder, audit or sign-in pages, nor while
  // they are typing; in those cases it waits until they're somewhere calmer.
  const openRef = useRef(false);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => {
    if (seen()) return;
    let visibleMs = 0;
    const id = setInterval(() => {
      if (document.hidden) return;
      visibleMs += TICK_MS;
      if (visibleMs < AUTO_OPEN_MS || openRef.current) return;
      if (seen()) { clearInterval(id); return; }
      if (BUSY_PAGES.test(window.location.pathname)) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      clearInterval(id);
      show();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [show]);

  // keyboard: arrows step, Esc closes, Tab stays inside
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? dialogRef.current;
    first?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if ((e.target as HTMLElement | null)?.closest?.("[role=radiogroup],[role=tablist]") && e.key.startsWith("Arrow")) return;
      if (e.key === "ArrowRight" && tag !== "INPUT" && tag !== "TEXTAREA") { setStep((s) => Math.min(STEPS.length - 1, s + 1)); }
      if (e.key === "ArrowLeft" && tag !== "INPUT" && tag !== "TEXTAREA") { setStep((s) => Math.max(0, s - 1)); }
      if (e.key === "Tab" && dialogRef.current) {
        const f = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === a || document.activeElement === dialogRef.current)) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [open, close]);

  if (!open) return null;
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="backdrop-in absolute inset-0 bg-[#0b1024]/45 backdrop-blur-[3px]" onClick={close} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="dialog-in glass glass-strong relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden !rounded-b-none outline-none sm:!rounded-[28px]">
        <div className="flex items-center justify-between gap-3 px-5 pt-4 sm:px-7 sm:pt-6">
          <div className="flex items-center gap-2" role="tablist" aria-label="Walkthrough steps">
            {STEPS.map((s, i) => (
              <button key={s} role="tab" aria-selected={i === step} aria-label={`Step ${i + 1}: ${s}`} onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all duration-300 ${i === step ? "w-7 bg-accent" : "w-2 bg-ink/20 hover:bg-ink/40"}`} />
            ))}
            <span className="ml-2 text-xs text-muted">{step + 1} of {STEPS.length}</span>
          </div>
          <button className="rounded-full px-2 py-1 text-sm text-muted hover:text-ink" onClick={close} aria-label="Close walkthrough">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-3 sm:px-7">
          <h2 id={titleId} className="display text-3xl sm:text-4xl">{STEPS[step]}</h2>
          <div key={step} className="pop-in mt-4">
            {step === 0 && <ConnectorStep />}
            {step === 1 && <PromptStep />}
            {step === 2 && <StepWatch onDone={close} />}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line/70 px-5 py-3 sm:px-7">
          <button className="btn" onClick={() => (step === 0 ? close() : setStep(step - 1))}>{step === 0 ? "Skip for now" : "Back"}</button>
          <span className="hidden text-xs text-muted sm:inline"><span className="kbd">←</span> <span className="kbd">→</span> to move, <span className="kbd">esc</span> to close</span>
          <button className="btn btn-primary" onClick={() => (last ? close() : setStep(step + 1))}>{last ? "Done" : step === 0 ? "It's connected" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- step 3: the live page ---------- */

const MINI = [
  { c: "DS 1002", d: [0, 2], t: 0.18, h: 0.16, hue: 221 },
  { c: "ECON 2020", d: [1, 3], t: 0.1, h: 0.2, hue: 24 },
  { c: "HIST 2001", d: [0, 2], t: 0.5, h: 0.16, hue: 158 },
  { c: "ENWR 2520", d: [1, 3], t: 0.46, h: 0.2, hue: 276 },
  { c: "KLPA 1105", d: [1], t: 0.75, h: 0.12, hue: 340 },
];

function StepWatch({ onDone }: { onDone: () => void }) {
  const p = usePhases(WATCH_DUR);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="text-sm">
        <p className="text-[15px]">Open your schedule next to the chat. Each change your AI makes lands on your week a few seconds later.</p>
        <ul className="mt-4 space-y-2">
          <Num n={1}><b>Schedule</b>: your week, color-coded, conflicts in red.</Num>
          <Num n={2}><b>Cart</b>: every SIS detail, with backup picks badged.</Num>
          <Num n={3}><b>Requirements</b>: what each class counts for and what you still owe.</Num>
        </ul>
        <Link href="/schedule" onClick={onDone} className="btn btn-primary btn-lg mt-5" data-autofocus>Open my schedule</Link>
        <p className="mt-3 text-xs text-muted">When the week looks right, paste the class numbers into SIS under Add by class number. Hoos Planner never enrolls you.</p>
      </div>
      <div aria-hidden="true">
        <MockWindow title="hoosplanner / your schedule">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Live from your chat · updated just now
          </div>
          <div className="grid grid-cols-5 gap-1 text-[9px]">
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, di) => (
              <div key={d}>
                <div className="pb-1 text-center text-muted">{d}</div>
                <div className="relative h-40 rounded-md bg-chip/60">
                  {MINI.map((b, i) => b.d.includes(di) && p > i && (
                    <div key={b.c} className="block-arrive absolute inset-x-0.5 overflow-hidden rounded px-0.5 font-semibold"
                      style={{ top: `${b.t * 100}%`, height: `${b.h * 100}%`, background: `hsl(${b.hue} 85% 60% / 0.3)`, color: `hsl(${b.hue} 70% 32%)` }}>{b.c}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </MockWindow>
      </div>
    </div>
  );
}
const WATCH_DUR = [700, 700, 700, 700, 700, 3200];

