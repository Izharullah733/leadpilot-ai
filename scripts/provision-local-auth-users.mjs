import { existsSync } from "node:fs";

if (existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env.local");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const parsedUrl = new URL(supabaseUrl);
const isLocal = ["127.0.0.1", "localhost"].includes(parsedUrl.hostname);
if (!isLocal && process.env.ALLOW_REMOTE_AUTH_PROVISIONING !== "true") {
  throw new Error(
    "Refusing to provision a remote Supabase project. This script is local/test-only.",
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is required. Use the local key shown by `supabase status -o env`.",
  );
}

const users = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Ahmed Khan",
    email: "ahmed.seed@leadpilot.local",
    password: process.env.LOCAL_AHMED_PASSWORD,
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Sara Malik",
    email: "sara.seed@leadpilot.local",
    password: process.env.LOCAL_SARA_PASSWORD,
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Usman Ali",
    email: "usman.seed@leadpilot.local",
    password: process.env.LOCAL_USMAN_PASSWORD,
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    name: "Hira Shah",
    email: "hira.seed@leadpilot.local",
    password: process.env.LOCAL_HIRA_PASSWORD,
  },
  {
    id: "00000000-0000-0000-0000-000000000006",
    name: "No Membership User",
    email: "no-membership.seed@leadpilot.local",
    password: process.env.LOCAL_NO_MEMBERSHIP_PASSWORD,
  },
  {
    id: "00000000-0000-0000-0000-000000000007",
    name: "Suspended User",
    email: "suspended.seed@leadpilot.local",
    password: process.env.LOCAL_SUSPENDED_PASSWORD,
  },
  {
    id: "00000000-0000-0000-0000-000000000008",
    name: "Stage Three Invitee",
    email: "invitee.seed@leadpilot.local",
    password: process.env.LOCAL_INVITEE_PASSWORD,
  },
];

for (const user of users) {
  if (!user.password || user.password.length < 12) {
    throw new Error(
      `Set a unique password of at least 12 characters for ${user.name} in the local environment.`,
    );
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.name },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Could not provision ${user.name}: ${response.status} ${detail}`);
  }

  console.log(`Provisioned local Auth credentials for ${user.name}.`);
}
