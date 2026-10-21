import type { Metadata } from "next";

export const metadata: Metadata = { title: "Security" };

export default function Page() {
  return (
    <article className="card p-6 max-w-3xl mx-auto prose-like space-y-4 leading-relaxed">
      <h1 className="text-2xl font-semibold">Security</h1>
      <p className="text-sm opacity-70">Effective 2026-10-21</p>

      <h2 className="text-lg font-semibold mt-6">Architecture</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>A Next.js app on Vercel with a Supabase Postgres database. Your browser talks only to this site. The only sign-in is the optional Sign in with ChatGPT, handled by OpenAI.</li>
        <li>Sign in with ChatGPT uses OpenAI&apos;s OAuth with PKCE. Tokens are stored AES-256-GCM encrypted, keyed by a hash of an httpOnly session cookie, and only the server calls OpenAI with them.</li>
        <li>The catalog is refreshed nightly by a server-side job using a service-role key that never reaches the browser.</li>
        <li>The live SIS and Stellic tools run only on your own Mac, through your own signed-in Chrome. The hosted connector never has them, and no SIS or Stellic session leaves your machine.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6">Database access</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Row-level security is enabled on every table. A database check fails if any table in the public schema lacks it.</li>
        <li><code>shared_plans</code>: no public policies; reachable only through server code that requires the 80-bit plan code.</li>
        <li>Catalog tables (terms, sections, ratings) are public read and writable only by the service role. The sync log is service role only.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6">Abuse limits</h2>
      <p>The plan, catalog, and connector endpoints are rate limited per client IP and cap request sizes. Limits are best effort and enforced per server instance.</p>

      <h2 className="text-lg font-semibold mt-6">Cart changes need your approval</h2>
      <p>The live tools can add or remove items in your SIS shopping cart only after a native macOS dialog on your own screen lists the exact class numbers and you click approve. The model cannot press that button, and cart changes are refused on other operating systems. Nothing ever clicks Enroll.</p>

      <h2 className="text-lg font-semibold mt-6">Browser protections</h2>
      <p>The site sends a Content Security Policy, HSTS, frame denial, no-sniff, a strict referrer policy, and a restrictive permissions policy.</p>

      <h2 className="text-lg font-semibold mt-6">Reporting a vulnerability</h2>
      <p>Open an issue on <a className="underline" href="https://github.com/Zrk1212/hoos-planner/issues">GitHub</a> saying you have a security report (leave the details out), and you&apos;ll get a private way to send them. See <a className="underline" href="/.well-known/security.txt">security.txt</a>. Please give us reasonable time to fix before disclosing, avoid accessing other people&apos;s data, and do not degrade the service. There is no bug bounty, but we will credit reporters who want it.</p>

    </article>
  );
}
