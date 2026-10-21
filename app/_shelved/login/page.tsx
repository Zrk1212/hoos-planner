"use client";
import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [linkError, setLinkError] = useState(false);
  useEffect(() => { setLinkError(new URLSearchParams(window.location.search).get("error") === "link"); }, []);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = browserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/schedule` },
    });
    if (error) { setState("error"); setMsg(error.message); } else setState("sent");
  }

  return (
    <div className="max-w-md mx-auto py-10 sm:py-16">
      <h1 className="h-page">Sign in with a magic link</h1>
      {linkError && <p className="card p-3 mt-4 text-sm text-warn" role="alert">That sign-in link didn&apos;t work. Links expire after an hour and must be opened in the same browser that requested them; send a new one below.</p>}
      <p className="text-muted text-sm mt-2">Any email works. Signing in only saves your plan and profile so they follow you between devices. No NetBadge.</p>
      {state === "sent" ? (
        <div className="glass p-5 mt-6 text-sm" role="status">Check <b>{email}</b> for a sign-in link. It opens the Builder with your saved plan.</div>
      ) : (
        <form onSubmit={send} className="glass p-5 mt-6 flex flex-col gap-3">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@virginia.edu" />
          <button className="btn btn-primary justify-center" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send magic link"}</button>
          {state === "error" && <p className="text-bad text-sm" role="alert">{msg}</p>}
        </form>
      )}
    </div>
  );
}
