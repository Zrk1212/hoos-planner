import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function Page() {
  return (
    <article className="card p-6 max-w-3xl mx-auto prose-like space-y-4 leading-relaxed">
      <h1 className="text-2xl font-semibold">Terms of use</h1>
      <p className="text-sm opacity-70">Effective 2026-10-21</p>
      <p>By using Hoos Planner you agree to these terms. Hoos Planner is not affiliated with or endorsed by the University of Virginia.</p>

      <h2 className="text-lg font-semibold mt-6">What the service is</h2>
      <p>A planning aid. You describe your schedule to your AI (Claude, ChatGPT or Codex), the Hoos Planner connector gives it the term&apos;s catalog, conflict checks and requirement checks, and this site shows the plan Claude saves. It never enrolls you in anything.</p>

      <h2 className="text-lg font-semibold mt-6">No warranty</h2>
      <p>The service is provided as is. Catalog data, seat counts, ratings, requirement checks and anything your AI tells you can be late, incomplete or wrong. Check against SIS, Stellic and your advisor before you act. Your enrollment decisions and deadlines are your responsibility.</p>

      <h2 className="text-lg font-semibold mt-6">Acceptable use</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Don&apos;t scrape or flood the API. Requests are rate limited and abusive clients get blocked.</li>
        <li>Don&apos;t automate SIS or Stellic beyond the optional Mac tools, which run in your own signed-in session and ask before any cart change.</li>
        <li>Don&apos;t use other people&apos;s plan codes, grades or data without their permission.</li>
        <li>Report security problems as described on the <a className="underline" href="/security">security page</a>.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6">Plan codes are secrets</h2>
      <p>Anyone with a plan code can read and change that plan. Keep it private. A leaked code can&apos;t be revoked, so delete the plan and start a new one.</p>

      <h2 className="text-lg font-semibold mt-6">Changes and contact</h2>
      <p>The service and these terms may change; the date above changes when they do. Questions: <a className="underline" href="https://github.com/Zrk1212/hoos-planner/issues">open an issue on GitHub</a>. See also the <a className="underline" href="/privacy">privacy page</a>.</p>
    </article>
  );
}
