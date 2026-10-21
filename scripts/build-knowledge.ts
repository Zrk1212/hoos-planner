/**
 * lib/mcp/knowledge.md is the editable source; lib/mcp/knowledge.ts is the generated module the
 * MCP server imports (no filesystem reads, so it works in Vercel bundles and from any cwd).
 *   npx tsx scripts/build-knowledge.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve(__dirname, "..", "lib", "mcp");
const md = readFileSync(join(dir, "knowledge.md"), "utf8");
const out = `// GENERATED from knowledge.md by scripts/build-knowledge.ts — do not edit by hand.\nexport const KNOWLEDGE = ${JSON.stringify(md)};\n`;
writeFileSync(join(dir, "knowledge.ts"), out);
console.log(`wrote lib/mcp/knowledge.ts (${md.length} chars)`);
