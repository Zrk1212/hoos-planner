"use client";
import { useEffect, useState } from "react";
import { FALLBACK_ORIGIN } from "./install-prompt";
import { useToast } from "./Toast";

/** ⌘C on Apple devices, Ctrl+C elsewhere. */
export const copyKeys = () => (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘C" : "Ctrl+C");

/** The site's own origin at runtime (so copied URLs match the deployment), with a stable SSR fallback. */
export function useOrigin() {
  const [origin, setOrigin] = useState(FALLBACK_ORIGIN);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  return origin;
}

export function CopyButton({ text, label = "Copy", done = "Copied", toastTitle, className = "btn btn-sm" }: { text: string; label?: string; done?: string; toastTitle?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      if (toastTitle) toast({ kind: "ok", title: toastTitle });
    } catch {
      toast({ kind: "error", title: "Clipboard is blocked", body: `Select the text and copy it with ${copyKeys()}.` });
    }
  }
  return <button type="button" className={className} onClick={copy}>{copied ? done : label}</button>;
}
