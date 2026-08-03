import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

if (existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env.local");
}

const baseURL = process.env.QA_BASE_URL ?? "http://localhost:3000";
const executablePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const email = process.env.QA_OWNER_EMAIL;
const password = process.env.QA_OWNER_PASSWORD;
if (!email || !password) throw new Error("Missing local owner QA credentials.");

const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in to LeadPilot" }).click();
  await page.waitForURL(`${baseURL}/dashboard`);
  await page.goto(`${baseURL}/leads/LP-1001`);
  await page.getByRole("heading", { name: "AI configuration missing" }).waitFor();
  if (await page.getByRole("button", { name: "Generate Insight" }).isVisible()) {
    throw new Error("Generation control remained available without server provider configuration.");
  }
  console.log("PASS Enabled company displays safe missing-provider state without exposing generation controls.");
} finally {
  await browser.close();
}
