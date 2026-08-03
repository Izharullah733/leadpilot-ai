import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const baseURL = process.env.QA_BASE_URL ?? "http://localhost:3000";
const executablePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
if (existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env.local");
}
const ownerEmail = process.env.QA_OWNER_EMAIL;
const ownerPassword = process.env.QA_OWNER_PASSWORD;
if (!ownerEmail || !ownerPassword) {
  throw new Error("QA owner environment credentials are required.");
}
const outputRoot = path.resolve("qa-artifacts", "screenshots");
const routes = [
  ["dashboard", "/dashboard"],
  ["leads", "/leads"],
  ["new-lead", "/leads/new"],
  ["follow-ups", "/follow-ups"],
  ["appointments", "/appointments"],
  ["reports", "/reports"],
  ["team", "/team"],
  ["settings", "/settings"],
];

const browser = await chromium.launch({ executablePath, headless: true });

for (const profile of [
  { name: "desktop-1440", viewport: { width: 1440, height: 1000 } },
  { name: "mobile-390", viewport: { width: 390, height: 844 } },
]) {
  const directory = path.join(outputRoot, profile.name);
  await mkdir(directory, { recursive: true });
  const context = await browser.newContext({ viewport: profile.viewport, colorScheme: "light" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  await page.goto(`${baseURL}/login`);
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  await page.screenshot({ path: path.join(directory, "login.png"), fullPage: true });

  await page.getByLabel("Email address").fill(ownerEmail);
  await page.getByRole("textbox", { name: "Password" }).fill(ownerPassword);
  await page.getByRole("button", { name: "Sign in to LeadPilot" }).click();
  await page.waitForURL(`${baseURL}/dashboard`);

  for (const [name, route] of routes) {
    await page.goto(`${baseURL}${route}`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
    console.log(`Captured ${profile.name}/${name}.png`);
  }
  await context.close();
}

await browser.close();
console.log(`Screenshots saved to ${outputRoot}`);
