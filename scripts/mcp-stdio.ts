/**
 * Local stdio MCP server (same tools as /api/mcp). Needs .env.local with the Supabase keys.
 *   claude mcp add hoos-planner -- npx tsx /path/to/hoos-planner/scripts/mcp-stdio.ts
 *   claude mcp add -s user -e LIVE_BROWSER=1 -e LIVE_WRITES=1 hoos-planner -- npx tsx .../scripts/mcp-stdio.ts
 * Live Stellic/SIS tools need LIVE_BROWSER=1; cart add/delete additionally LIVE_WRITES=1.
 */
import "./_env";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { SERVER_INFO, buildInstructions, registerPlannerTools } from "../lib/mcp/register";
import { LIVE_INSTRUCTIONS, registerLiveTools } from "../lib/mcp/live";

// Opt-in only: LIVE_BROWSER=1 enables the live Stellic/SIS read tools; LIVE_WRITES=1 additionally enables
// cart add/delete (each call still needs confirm:true plus a confirm_token after the student says yes).
const live = process.env.LIVE_BROWSER === "1";
const writes = live && process.env.LIVE_WRITES === "1";

serveStdio(() => {
  const server = new McpServer(SERVER_INFO, { instructions: buildInstructions({ live }) + (live ? LIVE_INSTRUCTIONS : "") });
  registerPlannerTools(server);
  if (live) registerLiveTools(server, undefined, { writes });
  return server;
});
