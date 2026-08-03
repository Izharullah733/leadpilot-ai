import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { buildHostedDemoSeedSql } from "./lib/hosted-demo-seed-sql.mjs";

const operatorEnv = path.resolve(".env.hosted-demo.local");
if (existsSync(operatorEnv) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(operatorEnv);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing guarded hosted-demo variable: ${name}.`);
  return value;
}

if (process.env.DEMO_SEED_ENABLED !== "true"
  || process.env.DEMO_ENVIRONMENT_NAME !== "leadpilot-demo") {
  throw new Error("Hosted demo seed is disabled. Both explicit demo guards are required.");
}

const projectRef = required("DEMO_SUPABASE_PROJECT_REF");
if (!/^[a-z0-9]{20}$/.test(projectRef)) throw new Error("The hosted Supabase project ref is invalid.");
const supabaseUrl = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
if (supabaseUrl.protocol !== "https:" || supabaseUrl.hostname !== `${projectRef}.supabase.co`) {
  throw new Error("The Supabase URL does not match the explicitly approved demo project ref.");
}
const databaseUrl = new URL(required("DEMO_DATABASE_URL"));
if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)
  || !`${databaseUrl.hostname}/${databaseUrl.username}`.includes(projectRef)) {
  throw new Error("The database URL does not match the explicitly approved demo project ref.");
}
const linkedRefPath = path.resolve("supabase", ".temp", "project-ref");
if (!existsSync(linkedRefPath) || readFileSync(linkedRefPath, "utf8").trim() !== projectRef) {
  throw new Error("The local Supabase CLI link does not match the approved demo project ref.");
}

const accounts = [
  ["00000000-0000-0000-0000-000000000001", "Ahmed Khan", "DEMO_OWNER_EMAIL", "DEMO_OWNER_PASSWORD"],
  ["00000000-0000-0000-0000-000000000002", "Sara Malik", "DEMO_ADMIN_EMAIL", "DEMO_ADMIN_PASSWORD"],
  ["00000000-0000-0000-0000-000000000003", "Usman Ali", "DEMO_MANAGER_EMAIL", "DEMO_MANAGER_PASSWORD"],
  ["00000000-0000-0000-0000-000000000004", "Hira Shah", "DEMO_REP_EMAIL", "DEMO_REP_PASSWORD"],
].map(([id, name, emailKey, passwordKey]) => {
  const email = required(emailKey).toLowerCase();
  const password = required(passwordKey);
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 14) {
    throw new Error(`Invalid guarded credentials for ${name}.`);
  }
  return { id, name, email, password };
});
if (new Set(accounts.map(account => account.email)).size !== accounts.length) {
  throw new Error("Hosted demo account emails must be unique.");
}

const sql = postgres(databaseUrl.toString(), {
  ssl: "require", max: 1, prepare: false, connect_timeout: 20,
});
const admin = createClient(supabaseUrl.toString(), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { authSql, publicSql } = buildHostedDemoSeedSql();

try {
  await sql.begin(async transaction => transaction.unsafe(authSql));
  for (const account of accounts) {
    const { error } = await admin.auth.admin.updateUserById(account.id, {
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.name },
    });
    if (error) throw new Error(`Hosted Auth provisioning failed for ${account.name}.`);
  }
  await sql.begin(async transaction => transaction.unsafe(publicSql));
  const [parity] = await sql`
    select count(*)::integer as total,
      count(*) filter (where stage = 'converted')::integer as converted,
      coalesce(sum(budget_pkr) filter (where stage not in ('converted','lost')), 0)::bigint as pipeline
    from public.leads
    where company_id = '10000000-0000-0000-0000-000000000001'
      and deleted_at is null
  `;
  if (parity.total !== 20 || parity.converted !== 4 || BigInt(parity.pipeline) !== 660000000n) {
    throw new Error("Hosted demo parity verification failed.");
  }
  console.log("Seeded the guarded leadpilot-demo tenant: 4 users, 20 leads, 4 converted, PKR 660,000,000 active pipeline.");
  console.log("AI remains disabled; no password or service credential was printed.");
} catch {
  throw new Error("Hosted demo seed failed safely. Inspect the hosted database/Auth logs without printing credentials.");
} finally {
  await sql.end({ timeout: 5 });
}
