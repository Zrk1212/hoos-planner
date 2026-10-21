import "./_env";
import { adminClient } from "../lib/supabase/admin";

async function main() {
  const { error } = await adminClient().rpc("assert_rls_enabled");
  if (error) { console.error(`RLS check FAILED: ${error.message}`); process.exit(1); }
  console.log("RLS check ok: every public table has row level security enabled.");
}
main();
