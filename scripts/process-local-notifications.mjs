import { execFileSync } from "node:child_process";
import path from "node:path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
if (!["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname)) {
  throw new Error("The local notification processor refuses non-local Supabase projects.");
}
const cli = path.resolve("node_modules", "supabase", "dist", "supabase.js");
const output = execFileSync(process.execPath, [cli, "status", "-o", "env"], {
  encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
});
const env = Object.fromEntries(output.split(/\r?\n/).filter(line => line.includes("=")).map(line => {
  const at = line.indexOf("=");
  return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, "")];
}));
if (!env.SERVICE_ROLE_KEY) throw new Error("Local service credential was unavailable.");
const response = await fetch(`${supabaseUrl}/rest/v1/rpc/process_follow_up_notifications`, {
  method: "POST",
  headers: { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
if (!response.ok) throw new Error("Local notification processing failed.");
const [result] = await response.json();
console.log(`Processed local follow-ups: ${result?.due_created ?? 0} due, ${result?.overdue_created ?? 0} overdue notifications created.`);
