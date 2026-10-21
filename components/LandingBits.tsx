"use client";
import { useRef } from "react";
import { openWalkthrough } from "./Walkthrough";

export function StartWalkthroughButton({ className = "btn btn-primary btn-lg", children = "Start the walkthrough" }: { className?: string; children?: React.ReactNode }) {
  return <button type="button" className={className} onClick={openWalkthrough}>{children}</button>;
}

/** Follows the pointer with a few degrees of tilt. Skipped for touch and reduced motion (CSS). */
export function Tilt({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  function move(e: React.PointerEvent) {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.setProperty("--ry", `${(x * 6).toFixed(2)}deg`);
    ref.current.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
  }
  function leave() { ref.current?.style.setProperty("--rx", "0deg"); ref.current?.style.setProperty("--ry", "0deg"); }
  return <div ref={ref} className={`tilt ${className}`} onPointerMove={move} onPointerLeave={leave}>{children}</div>;
}
