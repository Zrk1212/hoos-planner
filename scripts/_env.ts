import { config } from "dotenv";
import path from "node:path";

// Resolve from the repo root, not cwd: the stdio MCP server is launched from wherever Claude runs.
// quiet: dotenv must never print to stdout — stdout is the MCP stdio transport.
const root = path.resolve(__dirname, "..");
config({ path: path.join(root, ".env.local"), quiet: true });
config({ path: path.join(root, ".env"), quiet: true });
