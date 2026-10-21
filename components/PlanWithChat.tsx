"use client";
/**
 * /plan: sign in with ChatGPT and plan right on the site, the chat on one side and the live Schedule, Cart and
 * Requirements on the other. Off (a "coming soon" card with the connector setup) until OpenAI approves the app.
 */
import { useEffect, useState } from "react";
import { CartBody } from "./CartPage";
import { ChatPanel } from "./ChatPanel";
import { showOwnPlan, usePlanCode } from "./plan-code";
import { RequirementsBody } from "./RequirementsPage";
import { ScheduleBody } from "./SchedulePage";
import { useActivePlan } from "./useActivePlan";
import { openWalkthrough } from "./Walkthrough";

type Me = { enabled: boolean; signedIn: boolean; email?: string | null };
const SIGNIN_ERRORS: Record<string, string> = {
  denied: "You cancelled the ChatGPT sign-in. Try again whenever you're ready.",
  noplan: "Hoos Planner needs permission to use your ChatGPT plan. Sign in again and leave that box checked.",
  expired: "That sign-in took too long. Please try again.",
  error: "ChatGPT sign-in didn't work. Please try again.",
};

export function PlanWithChat() {
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<"chat" | "plan">("chat");
  const code = usePlanCode({ own: true });
  const signinError = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("signin") : null;

  useEffect(() => { fetch("/api/auth/chatgpt/me", { cache: "no-store" }).then((r) => r.json()).then(setMe).catch(() => setMe({ enabled: false, signedIn: false })); }, []);
  useEffect(() => { if (me?.signedIn) showOwnPlan(); }, [me?.signedIn]);

  if (!me) return <div className="skeleton mx-auto h-[420px] max-w-5xl !rounded-[22px]" />;

  if (!me.enabled) {
    return (
      <div className="mx-auto max-w-2xl py-8 text-center sm:py-14">
        <h1 className="display text-4xl sm:text-5xl">Plan right here with ChatGPT</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">Soon you&apos;ll sign in with ChatGPT and build your schedule on this page, using your own ChatGPT plan. Until then, connect Hoos Planner to Claude, ChatGPT or Codex in about two minutes.</p>
        <button type="button" className="btn btn-primary btn-lg mt-7" onClick={openWalkthrough}>Set it up in 2 minutes</button>
      </div>
    );
  }

  if (!me.signedIn) {
    return (
      <div className="mx-auto max-w-xl py-8 text-center sm:py-14">
        <h1 className="display text-4xl sm:text-5xl">Plan your spring with ChatGPT</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">Sign in with your ChatGPT account and describe the week you want. It runs on your ChatGPT Go, Plus or Pro plan, so it&apos;s free here. Hoos Planner never sees your password.</p>
        {signinError && SIGNIN_ERRORS[signinError] && <p className="mx-auto mt-4 max-w-md rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{SIGNIN_ERRORS[signinError]}</p>}
        <a href="/api/auth/chatgpt/start?next=/plan" className="btn btn-lg mt-7 !border-[#0d0d0d] !bg-[#0d0d0d] !text-white hover:!bg-[#2a2a2a] dark:!border-white dark:!bg-white dark:!text-[#0d0d0d]">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="currentColor"><path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.75-7.07zM13.26 22.43a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.79.79 0 0 0 .39-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.49 4.5zM3.6 18.3a4.47 4.47 0 0 1-.53-3.01l.14.08 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06l-4.83 2.79a4.5 4.5 0 0 1-6.15-1.64zM2.34 7.9a4.49 4.49 0 0 1 2.37-1.97v5.68a.77.77 0 0 0 .39.68l5.81 3.35-2.02 1.17a.08.08 0 0 1-.07 0l-4.83-2.79A4.5 4.5 0 0 1 2.34 7.87zm16.6 3.86-5.84-3.39 2.02-1.16a.08.08 0 0 1 .07 0l4.83 2.79a4.49 4.49 0 0 1-.68 8.1v-5.68a.79.79 0 0 0-.4-.66zm2.01-3.02-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.41 9.23V6.9a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66zM8.31 12.86 6.29 11.7a.08.08 0 0 1-.04-.06V6.08a4.5 4.5 0 0 1 7.38-3.45l-.14.08-4.78 2.76a.79.79 0 0 0-.39.68zm1.1-2.37 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5z" /></svg>
          Continue with ChatGPT
        </a>
        <p className="mx-auto mt-5 max-w-sm text-xs text-muted">Free ChatGPT accounts can connect Hoos Planner to the ChatGPT app instead. <button type="button" className="underline" onClick={openWalkthrough}>See how</button>.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-3 flex rounded-full bg-chip p-1 text-sm lg:hidden" role="tablist" aria-label="Chat or plan">
        {(["chat", "plan"] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`flex-1 rounded-full py-1.5 font-medium ${view === v ? "bg-[var(--accent-fill)] text-white" : "text-muted"}`}>{v === "chat" ? "Chat" : "My plan"}</button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className={view === "chat" ? "" : "hidden lg:block"}>
          {code && <ChatPanel code={code} email={me.email ?? null} onSignedOut={() => setMe({ ...me, signedIn: false })} />}
        </div>
        <div className={view === "plan" ? "" : "hidden lg:block"}><LivePanels /></div>
      </div>
    </div>
  );
}

const TABS = ["Schedule", "Cart", "Requirements"] as const;

function LivePanels() {
  const p = useActivePlan();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Schedule");
  const ready = p.state.kind === "ok" && !!p.catalog;
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center gap-1 text-sm" role="tablist" aria-label="Your plan">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-3.5 py-1.5 ${tab === t ? "lg-chip font-medium" : "text-muted hover:text-ink"}`}>{t}</button>
        ))}
        {ready && <span className="ml-auto flex items-center gap-1.5 text-xs text-muted"><span className="h-1.5 w-1.5 rounded-full bg-ok" />Live</span>}
      </div>
      {!ready ? (
        <div className="glass grid h-[320px] place-items-center !rounded-[22px] p-6 text-center text-sm text-muted">
          {p.state.kind === "loading" ? <div className="skeleton h-full w-full !rounded-[18px]" /> : <p>Your schedule shows up here as you chat.</p>}
        </div>
      ) : tab === "Schedule" ? <ScheduleBody p={p} /> : tab === "Cart" ? <CartBody p={p} /> : <RequirementsBody p={p} />}
    </div>
  );
}
