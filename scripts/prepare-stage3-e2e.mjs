import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env.local");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
if (!["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname)) {
  throw new Error("Stage 3 QA cleanup is local-only.");
}

const cli = path.resolve("node_modules", "supabase", "dist", "supabase.js");
const output = execFileSync(process.execPath, [cli, "status", "-o", "env"], {
  encoding: "utf8",
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
const env = Object.fromEntries(output.split(/\r?\n/).filter(line => line.includes("=")).map(line => {
  const at = line.indexOf("=");
  return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, "")];
}));
const serviceKey = env.SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error("Local service role was unavailable for QA cleanup.");

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
async function remove(resource, query) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${resource}?${query}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) throw new Error(`Could not reset local ${resource} QA fixture (${response.status}: ${await response.text()}).`);
}

async function read(resource, query) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${resource}?${query}`, { headers });
  if (!response.ok) throw new Error(`Could not inspect local ${resource} QA fixture.`);
  return response.json();
}

const company = "10000000-0000-0000-0000-000000000001";
const invitee = "00000000-0000-0000-0000-000000000008";
await remove("ai_usage_events", `company_id=eq.${company}`);
await remove("lead_ai_insights", `company_id=eq.${company}`);
for (const email of [
  "qa.lead@example.com",
  "qa.concurrent.one@example.com",
  "qa.concurrent.two@example.com",
]) {
  const leads = await read("leads", `select=id&email=eq.${encodeURIComponent(email)}`);
  for (const lead of leads) {
    await remove("appointments", `lead_id=eq.${lead.id}`);
    await remove("follow_ups", `lead_id=eq.${lead.id}`);
  }
}
await remove("appointments", "customer_name=eq.QA%20Standalone%20Consultation");
await remove("leads", "email=eq.qa.lead%40example.com");
await remove("leads", "email=eq.qa.concurrent.one%40example.com");
await remove("leads", "email=eq.qa.concurrent.two%40example.com");
await remove("membership_audit", `company_id=eq.${company}`);
await remove("company_invitations", `company_id=eq.${company}&email=eq.invitee.seed%40leadpilot.local`);
await remove("company_members", `company_id=eq.${company}&user_id=eq.${invitee}`);

const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ?? env.ANON_KEY;
const ownerEmail = process.env.QA_OWNER_EMAIL;
const ownerPassword = process.env.QA_OWNER_PASSWORD;
if (!publicKey || !ownerEmail || !ownerPassword) throw new Error("Owner QA credentials are required for controlled fixture restoration.");
const ownerClient = createClient(supabaseUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: authError } = await ownerClient.auth.signInWithPassword({ email: ownerEmail, password: ownerPassword });
if (authError) throw new Error("Could not authenticate the local QA owner for fixture restoration.");

const { data: settings, error: settingsReadError } = await ownerClient.from("company_settings")
  .select("updated_at").eq("company_id", company).single();
if (settingsReadError || !settings) throw new Error("Could not read local AI settings for fixture restoration.");
const { error: settingsUpdateError } = await ownerClient.rpc("update_company_ai_settings", {
  target_company_id: company,
  expected_updated_at: settings.updated_at,
  requested_settings: {
    version: 1, enabled: false,
    allowed_roles: ["owner", "admin", "sales_manager", "sales_representative"],
    model_reference: "environment_default", daily_company_limit: 50,
    monthly_company_limit: 500, user_hourly_limit: 10,
    regeneration_cooldown_minutes: 5, max_concurrent: 2,
    data_minimization_acknowledged: false, disclaimer_enabled: true,
    auto_generate_on_create: false,
  },
});
if (settingsUpdateError) throw new Error("Could not restore local AI settings through the controlled workflow.");

const leadId = "30000000-0000-0000-0000-000000000001";
const { data: lead, error: leadReadError } = await ownerClient.from("leads").select("*").eq("id", leadId).single();
if (leadReadError || !lead) throw new Error("Could not read the local AI lead fixture.");
const { error: leadUpdateError } = await ownerClient.rpc("update_lead", {
  target_company_id: company, target_lead_id: leadId, expected_updated_at: lead.updated_at,
  lead_full_name: lead.full_name, lead_phone: lead.phone, lead_email: lead.email ?? "",
  lead_service: lead.service_required, lead_location: lead.location,
  lead_property_size: lead.property_size ?? "", lead_budget_pkr: lead.budget_pkr,
  lead_expected_timeline: lead.expected_timeline, lead_source: lead.source,
  lead_assigned_member_id: lead.assigned_member_id, lead_score: 92,
  lead_temperature: "hot", lead_stage: lead.stage, lead_notes: lead.notes ?? "",
});
if (leadUpdateError) throw new Error("Could not restore the local AI lead through the controlled workflow.");
await ownerClient.auth.signOut();

await fetch("http://127.0.0.1:54324/api/v1/messages", { method: "DELETE" }).catch(() => undefined);
console.log("Reset local Stage 3 E2E membership fixtures without printing credentials.");
