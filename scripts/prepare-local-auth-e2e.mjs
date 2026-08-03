import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(".env.local");

function parseEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#") && line.includes("="))
      .map(line => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator);
        const value = line.slice(separator + 1).replace(/^"|"$/g, "");
        return [key, value];
      }),
  );
}

function newPassword() {
  return `${randomBytes(24).toString("base64url")}aA1!`;
}

const supabaseCliPath = path.resolve(
  "node_modules",
  "supabase",
  "dist",
  "supabase.js",
);
const statusText = execFileSync(
  process.execPath,
  [supabaseCliPath, "status", "-o", "env"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const status = parseEnv(statusText);
const existing = existsSync(envPath)
  ? parseEnv(readFileSync(envPath, "utf8"))
  : {};

const values = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  AI_PROVIDER: existing.AI_PROVIDER ?? "mock",
  AI_ALLOW_MOCK_IN_PRODUCTION_TESTS:
    existing.AI_ALLOW_MOCK_IN_PRODUCTION_TESTS ?? "true",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "54325",
  LOCAL_AHMED_PASSWORD: existing.LOCAL_AHMED_PASSWORD ?? newPassword(),
  LOCAL_SARA_PASSWORD: existing.LOCAL_SARA_PASSWORD ?? newPassword(),
  LOCAL_USMAN_PASSWORD: existing.LOCAL_USMAN_PASSWORD ?? newPassword(),
  LOCAL_HIRA_PASSWORD: existing.LOCAL_HIRA_PASSWORD ?? newPassword(),
  LOCAL_NO_MEMBERSHIP_PASSWORD:
    existing.LOCAL_NO_MEMBERSHIP_PASSWORD ?? newPassword(),
  LOCAL_SUSPENDED_PASSWORD:
    existing.LOCAL_SUSPENDED_PASSWORD ?? newPassword(),
  LOCAL_INVITEE_PASSWORD:
    existing.LOCAL_INVITEE_PASSWORD ?? newPassword(),
  QA_OWNER_EMAIL: "ahmed.seed@leadpilot.local",
  QA_OWNER_PASSWORD:
    existing.QA_OWNER_PASSWORD ?? existing.LOCAL_AHMED_PASSWORD ?? newPassword(),
  QA_REP_EMAIL: "hira.seed@leadpilot.local",
  QA_REP_PASSWORD:
    existing.QA_REP_PASSWORD ?? existing.LOCAL_HIRA_PASSWORD ?? newPassword(),
  QA_ADMIN_EMAIL: "sara.seed@leadpilot.local",
  QA_ADMIN_PASSWORD:
    existing.QA_ADMIN_PASSWORD ?? existing.LOCAL_SARA_PASSWORD ?? newPassword(),
  QA_MANAGER_EMAIL: "usman.seed@leadpilot.local",
  QA_MANAGER_PASSWORD:
    existing.QA_MANAGER_PASSWORD ?? existing.LOCAL_USMAN_PASSWORD ?? newPassword(),
  QA_INVITEE_EMAIL: "invitee.seed@leadpilot.local",
  QA_INVITEE_PASSWORD:
    existing.QA_INVITEE_PASSWORD ?? existing.LOCAL_INVITEE_PASSWORD ?? newPassword(),
  QA_NO_MEMBERSHIP_EMAIL: "no-membership.seed@leadpilot.local",
  QA_NO_MEMBERSHIP_PASSWORD:
    existing.QA_NO_MEMBERSHIP_PASSWORD ??
    existing.LOCAL_NO_MEMBERSHIP_PASSWORD ??
    newPassword(),
  QA_SUSPENDED_EMAIL: "suspended.seed@leadpilot.local",
  QA_SUSPENDED_PASSWORD:
    existing.QA_SUSPENDED_PASSWORD ??
    existing.LOCAL_SUSPENDED_PASSWORD ??
    newPassword(),
};

values.LOCAL_AHMED_PASSWORD = values.QA_OWNER_PASSWORD;
values.LOCAL_HIRA_PASSWORD = values.QA_REP_PASSWORD;
values.LOCAL_SARA_PASSWORD = values.QA_ADMIN_PASSWORD;
values.LOCAL_USMAN_PASSWORD = values.QA_MANAGER_PASSWORD;
values.LOCAL_INVITEE_PASSWORD = values.QA_INVITEE_PASSWORD;
values.LOCAL_NO_MEMBERSHIP_PASSWORD = values.QA_NO_MEMBERSHIP_PASSWORD;
values.LOCAL_SUSPENDED_PASSWORD = values.QA_SUSPENDED_PASSWORD;

for (const [key, value] of Object.entries(values)) {
  if (!value) throw new Error(`Local Supabase status did not provide ${key}.`);
  process.env[key] = value;
}
process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;

const fileBody = [
  "# Generated local-only Stage 2 authentication test environment.",
  "# This file is git-ignored. Never commit or print its password values.",
  ...Object.entries(values).map(([key, value]) => `${key}=${value}`),
  "",
].join("\n");
writeFileSync(envPath, fileBody, { encoding: "utf8", mode: 0o600 });

await import("./provision-local-auth-users.mjs");

console.log("Prepared repeatable local Auth E2E accounts without printing credentials.");
