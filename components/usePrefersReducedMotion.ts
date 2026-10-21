"use client";
import { useEffect, useState } from "react";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Steps through `durations` (ms per phase) in a loop while `active`. Returns the current phase.
 * Reduced motion pins the last phase so the finished state is shown without movement.
 */
export function usePhases(durations: number[], active = true) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (reduced || !active) return;
    const t = setTimeout(() => setPhase((p) => (p + 1) % durations.length), durations[phase]);
    return () => clearTimeout(t);
  }, [phase, reduced, active, durations]);
  return reduced ? durations.length - 1 : phase;
}

/** Types `text` out character by character once `start` is true. */
export function useTyped(text: string, start: boolean, speed = 70) {
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) { setN(0); return; }
    if (reduced) { setN(text.length); return; }
    if (n >= text.length) return;
    const t = setTimeout(() => setN((x) => x + 1), speed);
    return () => clearTimeout(t);
  }, [start, n, text, speed, reduced]);
  return text.slice(0, start ? (reduced ? text.length : n) : 0);
}

/** True while the element is on screen, so off-screen demos stop ticking. */
export function useInView<T extends Element>(ref: React.RefObject<T | null>) {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}
