// OpenAI's app-directory domain check: it fetches this path and expects the challenge token from the
// submission form, verbatim. The token lives in OPENAI_APPS_CHALLENGE so it can change without a commit.
export const dynamic = "force-dynamic";

export function GET() {
  const token = process.env.OPENAI_APPS_CHALLENGE?.trim();
  if (!token) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  return new Response(token, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
