/**
 * The planner tools as plain functions, for callers that aren't an MCP client: the in-site chat hands them to the
 * Responses API as function tools. Same registration as the MCP server (registerPlannerTools), so the two can't
 * drift: name, description, input schema (as JSON Schema) and handler.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { DEFAULT_TERM } from "../catalog";
import { registerPlannerTools } from "./register";

type ToolResult = { content: Array<{ type: string; text?: string }> };
export interface PlannerTool {
  name: string;
  description: string;
  /** JSON Schema of the arguments (object) */
  parameters: Record<string, unknown>;
  run: (args: unknown) => Promise<string>;
}

interface ToolConfig { description?: string; inputSchema?: z.ZodType }

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  void _drop;
  return rest;
}

export function plannerTools(term = DEFAULT_TERM): PlannerTool[] {
  const out: PlannerTool[] = [];
  const server = {
    registerTool(name: string, cfg: ToolConfig, handler: (args: never) => Promise<ToolResult>) {
      const schema = cfg.inputSchema ?? z.object({});
      out.push({
        name,
        description: cfg.description ?? name,
        parameters: jsonSchema(schema),
        async run(args) {
          // same validation the MCP server applies before calling a handler
          const parsed = schema.safeParse(args ?? {});
          if (!parsed.success) return `Invalid arguments for ${name}: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`;
          const res = await handler(parsed.data as never);
          return res.content.map((c) => c.text ?? "").join("\n");
        },
      });
    },
  } as unknown as McpServer;
  registerPlannerTools(server, term);
  return out;
}
