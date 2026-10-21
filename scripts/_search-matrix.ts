// Read-only: exercise every builder filter through the MCP catalog tools over stdio.
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { resolve } from "node:path";

async function main() {
  const client = new Client({ name: "matrix", version: "0" });
  const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === "string"));
  await client.connect(new StdioClientTransport({ command: "npx", args: ["tsx", resolve(__dirname, "mcp-stdio.ts")], cwd: "/", env }));
  const call = async (name: string, args: Record<string, unknown>) => (await client.callTool({ name, arguments: args }) as { content: Array<{ text?: string }> }).content.map((c) => c.text ?? "").join("\n");
  const cart = [18012, 14401, 14402, 14431, 20843, 13525, 13965];
  const cases: Array<[string, Record<string, unknown>, RegExp]> = [
    ["subject shortcut", { query: "PHIL", limit: 3 }, /PHIL \d{4}/],
    ["non-subject word", { query: "yoga", limit: 3 }, /KLPA 1410|Yoga/],
    ["class number", { query: "13965" }, /MUSI 2072/],
    ["AIP + 11am + diff<=2", { attrs: ["AIP"], earliest_start: "11:00", max_difficulty: 2, limit: 5 }, /CF [\d.]+\/[12](\.\d)?\//],
    ["unrated excluded by default", { attrs: ["AIP"], max_difficulty: 2, limit: 60 }, /^(?![\s\S]*CF none)/],
    ["unrated included", { query: "KLPA 1410", max_difficulty: 2, include_unrated: true, limit: 60 }, /#18029/],
    ["unrated excluded (KLPA 1410-004)", { query: "KLPA 1410", max_difficulty: 2, limit: 60 }, /^(?![\s\S]*#18029)/],
    ["engagement 1530 half A", { engagement: "1530", quarter: "A", limit: 3 }, /EGMT 1530.*\[first half\]/],
    ["engagement 1540 half B", { engagement: "1540", quarter: "B", limit: 3 }, /EGMT 1540.*\[second half\]/],
    ["SWR + CSW", { attrs: ["SWR", "CSW"], limit: 3 }, /ASUR-R21C2[\s\S]*ASUD-CSW|ASUD-CSW[\s\S]*ASUR-R21C2/],
    ["QCD", { attrs: ["QCD"], limit: 3 }, /ASUQ-QCD/],
    ["days TuTh only", { attrs: ["HP"], days: ["Tu", "Th"], limit: 5 }, /^(?![\s\S]*; (Mo|We|Fr)[A-Za-z]* \d)/],
    ["college only drops DS", { query: "DS 1001", college_only: true }, /No sections match/],
    ["avoid conflicts drops Yoga 18030", { query: "KLPA 1410", cart, avoid_conflicts: true, limit: 60 }, /^(?![\s\S]*#18030)/],
    ["without avoid, Yoga 18030 present", { query: "KLPA 1410", limit: 60 }, /#18030/],
    ["latest_end 2pm", { attrs: ["SS"], latest_end: "14:00", limit: 5 }, /^(?![\s\S]*[3-9]:\d\dpm)/],
    ["unknown cart number reported", { query: "MUSI 2072", cart: [99999] }, /99999/],
  ];
  let fails = 0;
  for (const [name, args, re] of cases) {
    const out = await call("search_sections", args);
    const ok = re.test(out);
    if (!ok) fails++;
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : "\n   " + out.slice(0, 400).replace(/\n/g, "\n   ")}`);
  }
  const conf = await call("check_conflicts", { class_nbrs: [13505, 13573] }); // Q3 + Q4 same slot
  console.log(/No time conflicts/.test(conf) ? "PASS Q3/Q4 same slot" : "FAIL Q3/Q4 same slot\n" + conf.slice(0, 300));
  const conf2 = await call("check_conflicts", { class_nbrs: [18012, 18030] });
  console.log(/Conflicts:/.test(conf2) ? "PASS Pickleball/Yoga conflict" : "FAIL conflict\n" + conf2.slice(0, 300));
  const rate = await call("rate_course", { course: "musi2072" });
  console.log(/DeVeaux/.test(rate) ? "PASS rate_course normalization" : "FAIL rate_course\n" + rate.slice(0, 200));
  const lp = await call("load_plan", { code: "0000000000000000000a" });
  console.log(/No plan/.test(lp) ? "PASS load_plan unknown code" : "FAIL load_plan\n" + lp.slice(0, 200));
  await client.close();
  console.log(fails ? `${fails} FAILURES` : "ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); });
