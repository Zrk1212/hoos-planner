"use client";
import { usePlan } from "@/lib/plan-store";
import { CopyButton, useOrigin } from "@/components/Copy";
import { macInstallPrompt as installPrompt } from "@/components/install-prompt";

function InstallPrompt({ origin }: { origin: string }) {
  const prompt = installPrompt(origin);
  return (
    <div className="mt-3">
      <pre className="input mono text-xs whitespace-pre-wrap select-all !rounded-2xl p-3">{prompt}</pre>
      <CopyButton text={prompt} label="Copy the prompt" className="btn btn-primary btn-sm mt-2" toastTitle="Installer prompt copied" />
    </div>
  );
}

function Code({ children, copy }: { children: string; copy?: boolean }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-2xl border border-line bg-elev p-2 pl-3">
      <pre className="mono min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap py-1 text-xs">{children}</pre>
      {copy && <CopyButton text={children} toastTitle="Copied" />}
    </div>
  );
}

export default function AdvisorPage() {
  const { plan } = usePlan();
  const origin = useOrigin();
  const mcpUrl = `${origin}/api/mcp`;
  const cart = plan.cart.map((c) => c.class_nbr).join(", ");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="h-page">Advisor = Claude + this catalog</h1>
      <p className="mt-3 text-muted">
        Instead of a chat box with its own API bill, Hoos Planner is an <b className="text-ink">MCP server</b>: connect it to your own Claude subscription
        (claude.ai, Claude Desktop or Claude Code) and ask Claude directly. It gets tools to search this term&apos;s cached catalog,
        check conflicts across 7-week halves, parse your audit, evaluate requirements, and save a plan code. It never touches SIS.
      </p>

      <section className="glass mt-6 !rounded-[22px] p-5">
        <h2 className="text-lg font-medium">Fastest: paste one prompt into your AI</h2>
        <p className="mt-1 text-sm text-muted">Works in Claude Code, the Claude app, Codex, Cursor or ChatGPT. On a Mac with an agent that can run commands it installs the full version; anywhere else it walks you through adding the connector. It never asks for your NetBadge password and never enrolls you.</p>
        <InstallPrompt origin={origin} />
      </section>

      <section className="card mt-4 !rounded-[22px] p-5">
        <h2 className="text-lg font-medium">Or connect by hand in claude.ai</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>Settings, then Connectors, then <b>Add custom connector</b>.</li>
          <li>Name: <span className="mono">Hoos Planner</span>. URL below. No authentication.</li>
          <li>Start a chat, enable the connector, and ask: <i>&quot;Which easy AIP fits my schedule after 11 am?&quot;</i></li>
        </ol>
        <Code copy>{mcpUrl}</Code>
        <h3 className="mt-5 text-sm font-medium">Claude Code or Claude Desktop</h3>
        <Code copy>{`claude mcp add --transport http hoos-planner ${mcpUrl}`}</Code>
      </section>

      <section className="card mt-4 !rounded-[22px] p-5">
        <h2 className="text-lg font-medium">Bring your plan into the chat</h2>
        <p className="mt-1 text-sm text-muted">Paste your Stellic audit text into the chat and say &quot;parse this&quot;, or tell Claude your cart:</p>
        <Code copy>{cart ? `My cart is ${cart}. Check it for conflicts and tell me what I still owe.` : "My cart is 18012, 14401, 14431. Check it for conflicts and tell me what I still owe."}</Code>
        <p className="mt-2 text-sm text-muted">Ask Claude to <b className="text-ink">save_plan</b> when you&apos;re happy; it returns a short code you can paste into a new chat (<b className="text-ink">load_plan</b>).</p>
      </section>

      <section className="card mt-4 !rounded-[22px] p-5">
        <h2 className="text-lg font-medium">Full version for Mac</h2>
        <p className="mt-1 text-sm text-muted">Reads your Stellic audit and SIS cart from your own signed-in Chrome and can fill your cart (each change asks you first). The prompt above installs it; to do it by hand, run <span className="mono select-all">curl -fsSL {origin}/install.sh | bash</span> in Terminal. <a className="underline hover:text-ink" href="/install.md">What it does</a></p>
      </section>

      <section className="card mt-4 !rounded-[22px] p-5 text-sm">
        <h2 className="text-lg font-medium">Tools it exposes</h2>
        <ul className="mt-2 space-y-1.5 text-muted">
          <li><b className="mono text-ink">search_sections</b>: filters for Discipline, Engagement area, half, days, earliest start, max difficulty, College-only; ranked easiest first; avoids your cart&apos;s conflicts.</li>
          <li><b className="mono text-ink">check_conflicts</b>: conflicts, credits, enroll order (smallest caps first), paste-ready class numbers.</li>
          <li><b className="mono text-ink">parse_audit</b> and <b className="mono text-ink">requirement_status</b>: Engagements, Literacies, Disciplines, credit rules, McIntire and SDS prerequisites.</li>
          <li><b className="mono text-ink">rate_course</b>: Course Forum rating, difficulty and GPA per instructor.</li>
          <li><b className="mono text-ink">get_planning_rules</b>, <b className="mono text-ink">get_term_info</b>, <b className="mono text-ink">save_plan</b>, <b className="mono text-ink">load_plan</b>.</li>
        </ul>
      </section>
    </div>
  );
}
