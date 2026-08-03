import { readFileSync } from "node:fs";
import path from "node:path";

function linesBetween(lines, first, last) {
  return lines.slice(first - 1, last);
}

function withoutTrailingComma(lines) {
  const copy = [...lines];
  copy[copy.length - 1] = copy[copy.length - 1].replace(/,$/, "");
  return copy;
}

export function buildHostedDemoSeedSql() {
  const source = readFileSync(path.resolve("supabase", "seed.sql"), "utf8");
  const lines = source.split(/\r?\n/);
  if (lines.length < 450 || !lines[5]?.startsWith("insert into auth.users")
    || !lines[235]?.startsWith("insert into public.leads")
    || !source.includes("Demo parity failed")) {
    throw new Error("The local seed layout changed; hosted demo seed derivation requires review.");
  }

  const authLines = [
    "-- Guarded hosted-demo Auth bootstrap derived from the reviewed local seed.",
    ...withoutTrailingComma(linesBetween(lines, 6, 27)),
    ...linesBetween(lines, 32, 37),
    ...withoutTrailingComma(linesBetween(lines, 39, 67)),
    ")",
    ...linesBetween(lines, 73, 76),
  ];

  const workflowLines = linesBetween(lines, 314, lines.length)
    .filter(line => !line.includes("70000000-0000-0000-0000-000000000002"))
    .map(line => line === "delete from public.notifications;"
      ? "delete from public.notifications where company_id = '10000000-0000-0000-0000-000000000001';"
      : line);

  const publicLines = [
    "-- Guarded hosted-demo business data: primary tenant only; no isolation fixtures.",
    ...withoutTrailingComma(linesBetween(lines, 78, 83)),
    ...linesBetween(lines, 88, 89),
    ...withoutTrailingComma(linesBetween(lines, 91, 111)),
    ...linesBetween(lines, 122, 130),
    ...withoutTrailingComma(linesBetween(lines, 132, 141)),
    ...linesBetween(lines, 143, 144),
    ...withoutTrailingComma(linesBetween(lines, 146, 158)),
    ...linesBetween(lines, 161, 166),
    ...linesBetween(lines, 168, 214),
    ...linesBetween(lines, 236, 283),
    ...workflowLines,
    "",
    "update public.company_settings",
    "set ai_settings = jsonb_set(jsonb_set(ai_settings, '{enabled}', 'false'::jsonb), '{data_minimization_acknowledged}', 'false'::jsonb),",
    "    updated_at = now()",
    "where company_id = '10000000-0000-0000-0000-000000000001';",
  ];

  const authSql = authLines.join("\n");
  const publicSql = publicLines.join("\n");
  for (const forbidden of [
    "10000000-0000-0000-0000-000000000002",
    "Isolation Test Company",
    "Tenant Isolation Lead",
    "00000000-0000-0000-0000-000000000005",
    "00000000-0000-0000-0000-000000000006",
    "00000000-0000-0000-0000-000000000007",
    "00000000-0000-0000-0000-000000000008",
  ]) {
    if (authSql.includes(forbidden) || publicSql.includes(forbidden)) {
      throw new Error("Hosted demo seed derivation included a local isolation fixture.");
    }
  }
  for (const required of ["LP-1001", "LP-1020", "Prime Build & Properties", "Demo parity failed"]) {
    if (!publicSql.includes(required)) throw new Error("Hosted demo seed derivation is incomplete.");
  }
  return { authSql, publicSql };
}
