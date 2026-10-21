// Read-only: snapshot the live SIS cart + planner text to a JSON file for before/after comparison.
import "./_env";
import { writeFileSync } from "node:fs";
import { readCart, readPlannerText } from "../lib/live/sis";

async function main() {
  const out = process.argv[2];
  const { cart } = await readCart(process.env.DEFAULT_TERM ?? "1272");
  const planner = await readPlannerText();
  const snap = {
    term: cart.term_descr,
    rows: cart.classes.map((c) => ({ class_nbr: c.class_nbr, course: `${c.subject} ${c.catalog_nbr}`, section: c.class_section, component: c.component, related: c.related })).sort((a, b) => a.class_nbr - b.class_nbr),
    planner: planner.replace(/\s+/g, " ").trim(),
  };
  writeFileSync(out, JSON.stringify(snap, null, 1));
  console.log(`${snap.term}: ${snap.rows.length} cart rows -> ${out}`);
  console.log(snap.rows.map((r) => `#${r.class_nbr} ${r.course}-${r.section}`).join(", "));
}
main().catch((e) => { console.error(e); process.exit(1); });
