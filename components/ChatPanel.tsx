"use client";
/**
 * The in-site chat (Sign in with ChatGPT). Streams /api/chat, keeps the transcript in this browser only, and
 * shows what the planner is doing while tools run. The live panels beside it follow the same plan code.
 */
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
const STARTERS = [
  "I'm a first-year. Build me a 15-credit spring with nothing before 10.",
  "I want to apply to McIntire. What should I take this spring?",
  "Find me the easiest Second Writing class that still has seats.",
  "Keep Fridays free and give me a backup for every class.",
];
const TOOL_LABEL: Record<string, string> = {
  search_sections: "Searching Spring 2027 classes", check_conflicts: "Checking for time conflicts", requirement_status: "Checking your requirements",
  parse_audit: "Reading your audit", rate_course: "Looking up Course Forum ratings", save_plan: "Updating your schedule",
  load_plan: "Opening your saved plan", get_planning_rules: "Reading the College rules", get_term_info: "Checking the term",
};
const KEY = (code: string) => `hp:chat:${code}`;
const MAX_KEEP = 40;

/** **bold** and "- " bullets, the two bits of markdown the model reliably uses. React escapes everything else. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
  const lines = text.replace(/^#+\s*/gm, "").split("\n");
  return <>{lines.map((l, i) => (/^\s*[-*•]\s+/.test(l) ? <div key={i} className="flex gap-2 pl-1"><span aria-hidden>•</span><span>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</span></div> : <div key={i} className={l.trim() ? "" : "h-2"}>{inline(l)}</div>))}</>;
}

export function ChatPanel({ code, email, onSignedOut }: { code: string; email: string | null; onSignedOut: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; reauth: boolean } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  // load before saving: the save must never run for a code whose transcript hasn't been read yet
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    try { const s = localStorage.getItem(KEY(code)); setMsgs(s ? JSON.parse(s) : []); } catch { setMsgs([]); }
    setLoadedFor(code);
  }, [code]);
  useEffect(() => {
    if (loadedFor !== code) return;
    try { localStorage.setItem(KEY(code), JSON.stringify(msgs.slice(-MAX_KEEP))); } catch { /* storage off */ }
  }, [msgs, code, loadedFor]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, activity]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history: Msg[] = [...msgs, { role: "user" as const, content }].slice(-MAX_KEEP);
    setMsgs([...history, { role: "assistant", content: "" }]);
    setDraft(""); setBusy(true); setError(null); setActivity("Thinking");
    const ctl = new AbortController(); abort.current = ctl;
    const append = (d: string) => setMsgs((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: c[c.length - 1].content + d }; return c; });
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planCode: code, messages: history.filter((m) => m.content) }), signal: ctl.signal });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({ error: "Something went wrong." }));
        throw Object.assign(new Error(j.error), { reauth: r.status === 401 });
      }
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i).replace(/^data:\s*/, ""); buf = buf.slice(i + 2);
          const ev = JSON.parse(line) as { type: string; delta?: string; name?: string; status?: string; message?: string; kind?: string };
          if (ev.type === "text" && ev.delta) { setActivity(null); append(ev.delta); }
          else if (ev.type === "tool") setActivity(ev.status === "start" ? TOOL_LABEL[ev.name ?? ""] ?? "Working" : "Thinking");
          else if (ev.type === "error") setError({ message: ev.message ?? "Something went wrong.", reauth: ev.kind === "reauth" || ev.kind === "scope" });
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError({ message: (e as Error).message, reauth: !!(e as { reauth?: boolean }).reauth });
    } finally {
      setBusy(false); setActivity(null); abort.current = null;
      setMsgs((m) => (m.length && m[m.length - 1].role === "assistant" && !m[m.length - 1].content ? m.slice(0, -1) : m));
    }
  }

  async function signOut() {
    await fetch("/api/auth/chatgpt/signout", { method: "POST" }).catch(() => {});
    onSignedOut();
  }

  return (
    <div className="glass flex h-[min(78dvh,760px)] min-h-[420px] flex-col !rounded-[22px]">
      <div className="flex items-center justify-between gap-2 border-b border-line/70 px-4 py-2.5 text-xs text-muted">
        <span className="truncate">ChatGPT{email ? ` · ${email}` : ""}</span>
        <span className="flex shrink-0 gap-3">
          {msgs.length > 0 && !busy && <button type="button" className="hover:text-ink" onClick={() => { if (confirm("Clear this conversation? Your saved plan stays.")) setMsgs([]); }}>New chat</button>}
          <button type="button" className="hover:text-ink" onClick={signOut}>Sign out</button>
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[14px] leading-6" aria-live="polite">
        {msgs.length === 0 && (
          <div>
            <p className="font-medium">Describe the semester you want.</p>
            <p className="mt-1 text-sm text-muted">Paste your Stellic audit for the most accurate plan, or just start talking. Your schedule fills in beside the chat.</p>
            <div className="mt-3 grid gap-2">
              {STARTERS.map((s) => <button key={s} type="button" className="rounded-xl border border-line bg-elev px-3 py-2 text-left text-sm hover:border-accent" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => m.role === "user"
          ? <div key={i} className="ml-auto w-fit max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--accent-fill)] px-3.5 py-2 text-white">{m.content}</div>
          : m.content ? <div key={i} className="max-w-[94%] rounded-2xl rounded-bl-md bg-chip px-3.5 py-2"><Rich text={m.content} /></div> : null)}
        {activity && <div className="flex items-center gap-2 text-xs text-muted"><span className="inline-block h-3 w-3 animate-spin rounded-full border border-line border-t-accent" />{activity}…</div>}
        {error && (
          <div className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
            {error.message} {error.reauth && <a className="underline" href="/api/auth/chatgpt/start?next=/plan">Sign in again</a>}
          </div>
        )}
        <div ref={end} />
      </div>
      <form className="flex items-end gap-2 border-t border-line/70 p-3" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={12000} aria-label="Message"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }}
          placeholder="No classes before 10, Fridays off…" className="min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-elev px-3 py-2 text-[14px] outline-none focus:border-accent" />
        {busy
          ? <button type="button" className="btn" onClick={() => abort.current?.abort()}>Stop</button>
          : <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>Send</button>}
      </form>
    </div>
  );
}
