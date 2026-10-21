"use client";
/**
 * Frame shared by the Schedule, Cart and Requirements pages: the live badge, the page title, a copy-link
 * button, and the states before there is anything to show (loading, or Claude hasn't saved to this code yet).
 */
import { CopyButton } from "./Copy";
import { isForeignCode, showOwnPlan } from "./plan-code";
import { ConnectorStep, PromptStep } from "./Setup";
import { useToast } from "./Toast";
import { useActivePlan, type ActivePlan } from "./useActivePlan";

function useAgoLabel(iso: string | undefined) {
  // re-rendered by the hook's polling; a coarse label is enough
  if (!iso) return "";
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function PlanShell({ title, blurb, children }: { title: string; blurb: string; children: (p: ActivePlan) => React.ReactNode }) {
  const plan = useActivePlan();
  const ago = useAgoLabel(plan.row?.updated_at);
  const { state } = plan;
  const { toast } = useToast();

  async function deletePlan() {
    if (!plan.code || !confirm("Delete this plan from Hoos Planner? Anyone with its link will lose it too. This can't be undone.")) return;
    const r = await fetch(`/api/plans?code=${plan.code}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { toast({ kind: "error", title: "Couldn't delete the plan", body: "Try again in a moment." }); return; }
    plan.startOver();
    toast({ kind: "ok", title: "Plan deleted", body: "Paste the new first message into a new chat to start again." });
  }

  if (state.kind === "waiting") {
    const foreign = !!plan.code && isForeignCode(plan.code);
    const deleted = state.deleted;
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-orange" />
          {deleted ? "This plan was deleted" : foreign ? "Nothing is saved at this link yet" : "Waiting for your chat · this page fills in on its own"}
        </div>
        <h1 className="display mt-2 text-4xl sm:text-5xl">{title}</h1>
        <p className="mt-2 max-w-xl text-muted">
          {deleted
            ? "Its link no longer works. To plan again, follow the two steps below."
            : foreign
            ? "If a friend sent you this link, ask them to send it again once their AI has saved their plan. To plan your own semester, follow the two steps below."
            : <>{blurb} Two steps and you&apos;re planning. Already added the connector? Skip to step 2.</>}
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="glass min-w-0 !rounded-[22px] p-5 sm:p-6">
            <div className="label">Step 1</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Connect Hoos Planner</h2>
            <div className="mt-4"><ConnectorStep compact /></div>
          </section>
          <section className="glass min-w-0 !rounded-[22px] p-5 sm:p-6">
            <div className="label">Step 2</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Paste your first message</h2>
            <div className="mt-4"><PromptStep compact /></div>
          </section>
        </div>
      </div>
    );
  }

  const foreign = !!plan.code && isForeignCode(plan.code);
  if (state.kind === "error" && !plan.row) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center sm:py-16">
        <h1 className="display text-4xl sm:text-5xl">{title}</h1>
        <div className="glass mx-auto mt-6 max-w-md !rounded-[22px] p-6">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-line border-t-accent" />
          <p className="mt-3 font-medium">{state.msg === "busy" ? "Hoos Planner is busy right now" : "Can't reach Hoos Planner right now"}</p>
          <p className="mt-1 text-sm text-muted">Your plan is safe. This page keeps trying and fills in as soon as it connects.</p>
        </div>
      </div>
    );
  }

  const loading = state.kind === "loading" || !plan.catalog;
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {!loading && (foreign ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="h-2 w-2 rounded-full bg-accent" /> Viewing a shared plan{ago && <> · updated {ago}</>}
              <button type="button" className="underline hover:text-ink" onClick={() => showOwnPlan()}>Back to my plan</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-ok" /></span>
              Live from your chat{ago && <> · updated {ago}</>}
            </div>
          ))}
          <h1 className="display mt-2 text-4xl sm:text-5xl">{title}</h1>
          <p className="mt-1 text-sm text-muted">{plan.catalog?.term.name ?? "Spring 2027"} · {blurb}</p>
        </div>
        {!loading && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm" onClick={() => { if (confirm("Start a new, empty plan? Your current plan stays saved at its link (copy it first). Then paste the new first message into a NEW chat.")) plan.startOver(); }}>New plan</button>
            <button type="button" className="btn btn-sm text-bad" onClick={deletePlan}>Delete plan</button>
          </div>
        )}
      </div>
      {!loading && plan.shareUrl && <ShareLink url={plan.shareUrl} />}
      {state.kind === "error" && <p className="mt-3 text-sm text-warn">Lost the connection for a moment. Retrying…</p>}
      {plan.catalogError && <p className="mt-3 text-sm text-bad">Could not load the class catalog. Reload the page to try again.</p>}
      <div className="mt-6">{loading ? <div className="skeleton h-[480px] !rounded-[22px]" /> : children(plan)}</div>
    </div>
  );
}

/** The plan's link, always visible so it can be copied by hand when the clipboard is blocked. */
function ShareLink({ url }: { url: string }) {
  return (
    <div className="mt-3 flex min-w-0 max-w-xl items-center gap-2 rounded-xl border border-line bg-elev px-3 py-1.5 text-xs">
      <span className="shrink-0 text-muted">Your link</span>
      <span className="mono min-w-0 flex-1 truncate select-all">{url}</span>
      <CopyButton text={url} label="Copy" toastTitle="Link copied" />
    </div>
  );
}

/** Shown inside a page when the plan exists but Claude hasn't added sections yet. */
export function WaitingForClaude({ what = "classes" }: { what?: string }) {
  return (
    <div className="glass grid h-[320px] place-items-center !rounded-[22px] p-6 text-center">
      <div>
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
        <p className="mt-4 font-medium">Waiting for your AI to add {what}</p>
        <p className="mt-1 text-sm text-muted">This page updates by itself. Keep chatting.</p>
      </div>
    </div>
  );
}
