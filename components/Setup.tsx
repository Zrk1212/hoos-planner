"use client";
/**
 * The two setup steps, shared by the walkthrough and the empty Schedule/Cart/Requirements pages:
 * add the Hoos Planner connector in the student's AI app (Claude, ChatGPT or Codex), then paste a first message that carries this browser's
 * plan code. Nothing to install; the Mac-only full version sits behind a disclosure.
 */
import { useEffect, useRef, useState } from "react";
import { copyKeys, useOrigin } from "./Copy";
import { CLAUDE_CONNECTORS_URL, CONNECTOR_NAME, agentSetupPrompt, claudeCodeCommand, codexCommand, connectorUrl, firstMessage, macInstallPrompt } from "./install-prompt";
import { showOwnPlan, usePlanCode } from "./plan-code";
import { useToast } from "./Toast";
import { usePhases, useTyped } from "./usePrefersReducedMotion";

/** Copies `text`; if the browser blocks the clipboard, selects `fallback` so one copy shortcut finishes the job. */
function useCopy(text: string, fallback: React.RefObject<HTMLElement | null>, onCopy?: () => void) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  async function copy(): Promise<boolean> {
    onCopy?.();
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 4000); return true; }
    catch {
      const el = fallback.current, sel = window.getSelection();
      if (el && sel) { const r = document.createRange(); r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r); }
      toast({ kind: "error", title: `Press ${copyKeys()} to copy`, body: "Your browser blocked the copy button, so the text is selected for you." });
      return false;
    }
  }
  return { copied, copy };
}

export function Num({ n, done = false, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors ${done ? "bg-ok text-white" : "bg-chip text-ink"}`}>{done ? "✓" : n}</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function Field({ label, value, toast }: { label: string; value: string; toast: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { copied, copy } = useCopy(value, ref);
  const { toast: show } = useToast();
  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-2 rounded-xl border border-line bg-elev px-3 py-1.5">
      <span className="w-12 shrink-0 text-[11px] text-muted">{label}</span>
      <span ref={ref} className="mono min-w-0 flex-1 break-all text-[13px] leading-5 select-all">{value}</span>
      <button type="button" className="btn btn-sm shrink-0" aria-label={`Copy ${label === "Run" ? "the command" : `the ${label.toLowerCase()}`}`} onClick={async () => { if (await copy()) show({ kind: "ok", title: toast }); }}>{copied ? "Copied" : "Copy"}</button>
    </div>
  );
}

/* ---------- step 1: the connector ---------- */

/* ---------- which AI app ---------- */

export type AiApp = "claude" | "claude-code" | "codex" | "chatgpt";
const APPS: { id: AiApp; label: string }[] = [{ id: "claude", label: "Claude" }, { id: "claude-code", label: "Claude Code" }, { id: "codex", label: "Codex" }, { id: "chatgpt", label: "ChatGPT" }];
const APP_KEY = "hp:ai-app";
const APP_EVENT = "hp:ai-app";
export const appName = (a: AiApp) => APPS.find((x) => x.id === a)!.label;

/** The student's AI app, remembered so the walkthrough and the empty plan pages show the same steps. */
export function useAiApp(): [AiApp, (a: AiApp) => void] {
  const [app, setApp] = useState<AiApp>("claude");
  useEffect(() => {
    const read = () => { try { const v = localStorage.getItem(APP_KEY); if (APPS.some((a) => a.id === v)) setApp(v as AiApp); } catch { /* storage off */ } };
    read();
    window.addEventListener(APP_EVENT, read);
    return () => window.removeEventListener(APP_EVENT, read);
  }, []);
  const choose = (a: AiApp) => {
    setApp(a);
    try { localStorage.setItem(APP_KEY, a); } catch { /* storage off */ }
    window.dispatchEvent(new CustomEvent(APP_EVENT));
  };
  return [app, choose];
}

function AppPicker({ app, onChange }: { app: AiApp; onChange: (a: AiApp) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // radiogroup keys: arrows move the choice (and focus), one Tab stop for the group
  function onKey(e: React.KeyboardEvent) {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    const i = (APPS.findIndex((a) => a.id === app) + d + APPS.length) % APPS.length;
    onChange(APPS[i].id);
    requestAnimationFrame(() => ref.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[i]?.focus());
  }
  return (
    <div ref={ref} role="radiogroup" aria-label="Which AI app do you use?" onKeyDown={onKey} className="inline-flex flex-wrap rounded-[18px] bg-chip p-1">
      {APPS.map((a) => (
        <button key={a.id} type="button" role="radio" aria-checked={app === a.id} tabIndex={app === a.id ? 0 : -1} onClick={() => onChange(a.id)}
          className={`whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${app === a.id ? "bg-[var(--accent-fill)] text-white shadow-sm" : "text-muted hover:text-ink"}`}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- step 1: the connector ---------- */

const CHATGPT_SETTINGS_URL = "https://chatgpt.com/#settings/Connectors";
// The Hoos Planner page in ChatGPT's app directory, once OpenAI lists it; until then the ChatGPT tab shows Developer mode only
const CHATGPT_APP_URL = process.env.NEXT_PUBLIC_CHATGPT_APP_URL;

export function ConnectorStep({ compact = false }: { compact?: boolean }) {
  const origin = useOrigin();
  const url = connectorUrl(origin);
  const [app, setApp] = useAiApp();
  return (
    <div className="min-w-0 max-w-2xl text-sm">
      <div className="label">Connector URL</div>
      <Field label="URL" value={url} toast="Connector URL copied" />
      <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs text-muted">Add it in</span><AppPicker app={app} onChange={setApp} /></div>
      <div key={app} className="pop-in mt-3">
        {app === "claude" && <>
          <ol className="space-y-2.5">
            <Num n={1}>Open Claude&apos;s connector settings on a computer. <a className="btn btn-primary btn-sm ml-1" href={CLAUDE_CONNECTORS_URL} target="_blank" rel="noopener noreferrer" aria-label="Open Claude settings (opens in a new tab)">Open settings ↗</a></Num>
            <Num n={2}>Click <b>Add custom connector</b>. Name it <b>{CONNECTOR_NAME}</b> and paste the URL.</Num>
            <Num n={3}>Click <b>Add</b>. It works on your phone too.</Num>
          </ol>
          <Permission app="Claude" choice="Always allow" />
        </>}
        {app === "claude-code" && <AgentSteps app="Claude Code" command={claudeCodeCommand(origin)} where="the Code tab in the Claude desktop app, or claude in Terminal" />}
        {app === "codex" && <AgentSteps app="Codex" command={codexCommand(origin)} where="the Codex app, CLI or IDE extension" />}
        {app === "chatgpt" && CHATGPT_APP_URL && <>
          <a className="btn btn-primary" href={CHATGPT_APP_URL} target="_blank" rel="noopener noreferrer" aria-label="Add Hoos Planner from the ChatGPT app directory (opens in a new tab)">Add Hoos Planner from the ChatGPT app directory ↗</a>
          <p className="mt-2 text-xs text-muted">Click <b>Add</b> on the Hoos Planner page, then pick it from <b>+</b> in a new chat.</p>
          <details className="mt-4">
            <summary className="cursor-pointer select-none text-xs text-muted hover:text-ink">Not listed yet? Add it in Developer mode</summary>
            <div className="mt-3"><ChatGptDevSteps /></div>
          </details>
        </>}
        {app === "chatgpt" && !CHATGPT_APP_URL && <ChatGptDevSteps />}
      </div>
      {!compact && <MacVersion origin={origin} />}
    </div>
  );
}

/** ChatGPT before the directory listing: a custom connector in Developer mode. */
function ChatGptDevSteps() {
  return (
    <>
      <ol className="space-y-2.5">
        <Num n={1}>In ChatGPT settings, open <b>Apps &amp; Connectors</b> → <b>Advanced settings</b> and turn on <b>Developer mode</b>. <a className="btn btn-primary btn-sm ml-1" href={CHATGPT_SETTINGS_URL} target="_blank" rel="noopener noreferrer" aria-label="Open ChatGPT settings (opens in a new tab)">Open settings ↗</a></Num>
        <Num n={2}>Click <b>Create</b>. Name it <b>{CONNECTOR_NAME}</b>, paste the URL, pick <b>No authentication</b>, tick <b>I trust this application</b>.</Num>
        <Num n={3}>In each new chat, click <b>+</b> → <b>Developer mode</b> → Hoos Planner.</Num>
      </ol>
      <p className="mt-3 text-xs text-muted">Needs ChatGPT Plus or higher.</p>
      <Permission app="ChatGPT" choice="Confirm" />
    </>
  );
}

/** Claude Code / Codex: they can run the command themselves, so the student pastes one line and restarts. */
function AgentSteps({ app, command, where }: { app: string; command: string; where: string }) {
  const prompt = agentSetupPrompt(command, app);
  const ref = useRef<HTMLPreElement>(null);
  const { copied, copy } = useCopy(prompt, ref);
  return (
    <>
      <ol className="space-y-2.5">
        <Num n={1} done={copied}>
          Paste this into {app} ({where}):
          <pre ref={ref} className="mono mt-1.5 whitespace-pre-wrap break-all rounded-xl border border-line bg-elev p-2.5 text-[11.5px] leading-5 select-all">{prompt}</pre>
          <button type="button" onClick={copy} className="btn btn-primary btn-sm mt-1.5" aria-label={`Copy the ${app} setup prompt`}>{copied ? "Copied" : "Copy"}</button>
        </Num>
        <Num n={2}>When it asks to run the command, click <b>Allow</b>.</Num>
        <Num n={3}><b>Quit and reopen {app}</b> so it loads Hoos Planner.</Num>
      </ol>
      <p className="mt-3 text-xs text-muted">Comfortable in Terminal? Run the command yourself instead:</p>
      <Field label="Run" value={command} toast="Command copied" />
    </>
  );
}

function Permission({ app, choice }: { app: string; choice: string }) {
  return (
    <p className="mt-4 text-xs leading-5 text-muted">
      The first time {app} uses a Hoos Planner tool it asks permission. Pick <b className="text-ink">{choice}</b>. The tools read UVA&apos;s public class list and save your plan to this site. They can&apos;t see your SIS or NetBadge account.
    </p>
  );
}

function MacVersion({ origin }: { origin: string }) {
  const prompt = macInstallPrompt(origin);
  const ref = useRef<HTMLPreElement>(null);
  const { copied, copy } = useCopy(prompt, ref);
  return (
    <details className="group mt-4 text-sm">
      <summary className="cursor-pointer select-none text-xs text-muted hover:text-ink">Advanced: let Claude read your SIS cart and Stellic directly (Mac + Claude Code)</summary>
      <div className="mt-2 space-y-2 text-xs text-muted">
        <p>Most students skip this. It installs a local version that reads your signed-in Chrome. Paste this into Claude Code:</p>
        <pre ref={ref} className="mono max-h-28 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-elev p-2.5 text-[11px] leading-5">{prompt}</pre>
        <button type="button" className="btn btn-sm" onClick={copy}>{copied ? "Copied" : "Copy the Mac setup prompt"}</button>
      </div>
    </details>
  );
}

/* ---------- step 2: the first message ---------- */

export function PromptStep({ compact = false }: { compact?: boolean }) {
  const code = usePlanCode({ own: true });
  const [app] = useAiApp();
  const name = appName(app);
  const msg = firstMessage(code ?? "…");
  const ref = useRef<HTMLPreElement>(null);
  // the pages switch to this code, so they're watching the plan this chat will fill
  const { copied, copy } = useCopy(msg, ref, showOwnPlan);
  return (
    <div className={compact ? "" : "grid gap-5 md:grid-cols-2"}>
      <div className="min-w-0 text-sm">
        <p className="text-[15px]">{app === "claude-code" || app === "codex" ? `Quit and reopen ${name} if you haven't, then open a new chat and paste this.` : `Open a new ${name} chat and paste this.`} It carries your plan code, so your schedule lands on this site.</p>
        <pre ref={ref} className="mono mt-3 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-line bg-elev p-3 text-[11.5px] leading-5 select-all">{msg}</pre>
        <button type="button" onClick={copy} disabled={!code} className="btn btn-primary btn-lg mt-3 w-full justify-center" data-autofocus={compact ? true : undefined}>
          {copied ? "Copied. Paste it into a new chat" : "Copy your first message"}
        </button>
        <p className="mt-3 text-xs text-muted">Then talk to it like a friend who knows the course catalog: “no classes before 10”, “I want Fridays off”, “find me an easy Second Writing class”.</p>
      </div>
      {!compact && <div aria-hidden="true"><ChatMock name={name} /></div>}
    </div>
  );
}

const CHAT_DUR = [1800, 900, 5200];

function ChatMock({ name }: { name: string }) {
  const p = usePhases(CHAT_DUR);
  const q = useTyped("No 8 a.m.s, Fridays off, and knock out Historical Perspectives.", p >= 0, 34);
  const a = useTyped("Done: 15 credits, Monday to Thursday, first class at 10:00. HIST 2001 covers Historical Perspectives (difficulty 2.1). Your schedule page is updated.", p >= 2, 12);
  return (
    <MockWindow title={name}>
      <div className="min-h-[220px] space-y-2 text-[12px]">
        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#2563eb] px-3 py-1.5 text-white">{q || " "}</div>
        {p >= 1 && <div className="pop-in text-[11px] text-muted">Used Hoos Planner: search_sections, check_conflicts, save_plan</div>}
        {p >= 2 && <div className="pop-in max-w-[92%] rounded-2xl rounded-bl-md bg-chip px-3 py-2 leading-5">{a}</div>}
      </div>
    </MockWindow>
  );
}

export function MockWindow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-elev ring-1 ring-line shadow-[0_20px_50px_-24px_rgb(15_22_49/0.45)]">
      <div className="flex items-center gap-1.5 bg-chip/70 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#ff5f57]" /><span className="h-2 w-2 rounded-full bg-[#febc2e]" /><span className="h-2 w-2 rounded-full bg-[#28c840]" />
        <span className="ml-2 truncate text-[11px] text-muted">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
