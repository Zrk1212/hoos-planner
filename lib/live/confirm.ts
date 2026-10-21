/**
 * Human-in-the-loop gate for the cart-writing tools. The MCP client (the model) cannot approve a cart change:
 * on the confirming call the server shows a native macOS dialog on the student's own screen listing the exact
 * class numbers, and proceeds only if the student clicks the approve button. Nothing the model sends — and
 * nothing injected into page text — can press that button. On non-macOS hosts the write is refused.
 */
import { spawn } from "node:child_process";

export type WriteAction = "add" | "delete";

export interface HumanVerdict { approved: boolean; reason: string }

export async function askHuman(action: WriteAction, classNbrs: number[], detail: string, timeoutMs = 120_000): Promise<HumanVerdict> {
  if (process.platform !== "darwin") return { approved: false, reason: "Cart changes need the macOS confirmation dialog; this host is not macOS." };
  const verb = action === "add" ? "Add to my SIS cart" : "Remove from my SIS cart";
  const list = [...new Set(classNbrs)].sort((a, b) => a - b).map((n) => `#${n}`).join(", ");
  const msg = `Hoos Planner wants to ${action === "add" ? "ADD" : "REMOVE"} ${list}\n${detail}\n\nThis changes your real SIS shopping cart (it never enrolls).`.replace(/["\\]/g, " ");
  const script = `display dialog "${msg}" with title "Hoos Planner — confirm cart change" buttons {"Cancel", "${verb}"} default button "Cancel" cancel button "Cancel" with icon caution giving up after ${Math.floor(timeoutMs / 1000)}`;
  return new Promise((resolve) => {
    const p = spawn("osascript", ["-e", script], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => { out += d.toString(); });
    p.on("error", (e) => resolve({ approved: false, reason: `Could not show the confirmation dialog: ${e.message}` }));
    p.on("close", (code) => {
      if (code !== 0) return resolve({ approved: false, reason: "The student cancelled the confirmation dialog." });
      if (/gave up:true/.test(out)) return resolve({ approved: false, reason: "The confirmation dialog timed out with no answer." });
      if (out.includes(`button returned:${verb}`)) return resolve({ approved: true, reason: "approved in the macOS dialog" });
      resolve({ approved: false, reason: `Unexpected dialog result: ${out.trim().slice(0, 120)}` });
    });
  });
}
