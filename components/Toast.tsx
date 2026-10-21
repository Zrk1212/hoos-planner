"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePlan } from "@/lib/plan-store";

type Kind = "ok" | "error" | "info";
interface ToastItem { id: number; kind: Kind; title: string; body?: string }
interface ToastCtx { toast: (t: { kind?: Kind; title: string; body?: string; ms?: number }) => void }

const Ctx = createContext<ToastCtx | null>(null);
const NOOP: ToastCtx = { toast: () => {} };

/** Toasts for confirmations and recoverable errors. Polite live region; errors use role="alert". */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const toast = useCallback<ToastCtx["toast"]>(({ kind = "info", title, body, ms }) => {
    const id = next.current++;
    setItems((xs) => [...xs.filter((x) => x.title !== title).slice(-3), { id, kind, title, body }]);
    timers.current.set(id, setTimeout(() => dismiss(id), ms ?? (kind === "error" ? 7000 : 3200)));
  }, [dismiss]);

  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach(clearTimeout); map.clear(); };
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end">
        {items.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"}
            className="toast-in glass glass-strong pointer-events-auto flex w-full max-w-sm items-start gap-3 !rounded-2xl px-4 py-3 text-sm">
            <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.kind === "ok" ? "bg-ok" : t.kind === "error" ? "bg-bad" : "bg-accent"}`} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{t.title}</div>
              {t.body && <div className="mt-0.5 text-muted">{t.body}</div>}
            </div>
            <button className="-mr-1 rounded-full px-1.5 text-muted hover:text-ink" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">✕</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx { return useContext(Ctx) ?? NOOP; }

/** Raises one toast each time account sync flips to "error". Lives inside both providers. */
export function SyncToaster() {
  const { syncState } = usePlan();
  const { toast } = useToast();
  const prev = useRef(syncState);
  useEffect(() => {
    if (syncState === "error" && prev.current !== "error") {
      toast({ kind: "error", title: "Couldn't save to your account", body: "Your plan is still saved on this device." });
    }
    prev.current = syncState;
  }, [syncState, toast]);
  return null;
}
