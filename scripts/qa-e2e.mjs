import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";

if (existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env.local");
}

const baseURL = process.env.QA_BASE_URL ?? "http://localhost:3000";
const executablePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const results = [];
const errors = [];
let activeCheck = "setup";
let supabaseSessionCookieName;
const accounts = {
  owner: {
    email: process.env.QA_OWNER_EMAIL,
    password: process.env.QA_OWNER_PASSWORD,
  },
  representative: {
    email: process.env.QA_REP_EMAIL,
    password: process.env.QA_REP_PASSWORD,
  },
  admin: {
    email: process.env.QA_ADMIN_EMAIL,
    password: process.env.QA_ADMIN_PASSWORD,
  },
  manager: {
    email: process.env.QA_MANAGER_EMAIL,
    password: process.env.QA_MANAGER_PASSWORD,
  },
  invitee: {
    email: process.env.QA_INVITEE_EMAIL,
    password: process.env.QA_INVITEE_PASSWORD,
  },
  noMembership: {
    email: process.env.QA_NO_MEMBERSHIP_EMAIL,
    password: process.env.QA_NO_MEMBERSHIP_PASSWORD,
  },
  suspended: {
    email: process.env.QA_SUSPENDED_EMAIL,
    password: process.env.QA_SUSPENDED_PASSWORD,
  },
};

for (const [name, account] of Object.entries(accounts)) {
  if (!account.email || !account.password) {
    throw new Error(`Missing environment credentials for QA ${name} account.`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, callback) {
  activeCheck = name;
  try {
    await callback();
    results.push({ name, status: "PASS" });
    console.log(`PASS ${name}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, status: "FAIL", detail });
    console.log(`FAIL ${name} — ${detail}`);
  }
}

async function signIn(targetPage, account) {
  await targetPage.getByLabel("Email address").fill(account.email);
  await targetPage.getByRole("textbox", { name: "Password" }).fill(account.password);
  await targetPage.getByRole("button", { name: "Sign in to LeadPilot" }).click();
}

function trackRuntimeErrors(targetPage) {
  targetPage.on("console", message => {
    const location = message.location().url;
    const expectedInvalidLogin =
      message.type() === "error" &&
      message.text().includes("400") &&
      location.includes("/auth/v1/token");
    if (message.type() === "error" && !expectedInvalidLogin) {
      errors.push(`console during ${activeCheck}: ${message.text()} (${location || "unknown source"})`);
    }
  });
  targetPage.on("pageerror", error => errors.push(`pageerror during ${activeCheck} at ${targetPage.url()}: ${error.message}`));
  targetPage.on("response", response => {
    const expectedInvalidLogin =
      response.status() === 400 &&
      response.url().includes("/auth/v1/token") &&
      response.url().includes("grant_type=password");
    if (response.status() >= 400 && !expectedInvalidLogin) {
      errors.push(`http ${response.status()} during ${activeCheck}: ${response.url()}`);
    }
  });
}

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
const page = await context.newPage();
page.setDefaultTimeout(20000);
trackRuntimeErrors(page);

await check("Protected routes redirect unauthenticated users", async () => {
  await page.goto(`${baseURL}/dashboard`);
  await page.waitForURL(/\/login\?next=%2Fdashboard/);
});

await check("Forging the retired demo cookie cannot grant access", async () => {
  await context.addCookies([{
    name: "leadpilot_demo_auth",
    value: "authenticated",
    domain: "localhost",
    path: "/",
  }]);
  await page.goto(`${baseURL}/dashboard`);
  await page.waitForURL(/\/login\?next=%2Fdashboard/);
  await context.clearCookies();
});

await check("Invalid credentials show a clear error", async () => {
  await page.getByLabel("Email address").fill(accounts.owner.email);
  await page.getByRole("textbox", { name: "Password" }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in to LeadPilot" }).click();
  await page.getByText("The email or password is incorrect. Please try again.").waitFor();
});

await check("Valid owner login, safe next redirect, and refresh work", async () => {
  await page.goto(`${baseURL}/login?next=${encodeURIComponent("//external.example/steal")}`);
  await signIn(page, accounts.owner);
  await page.waitForURL(`${baseURL}/dashboard`);
  const cookies = await context.cookies();
  assert(!cookies.some(item => item.name === "leadpilot_demo_auth"), "Retired demo cookie was created.");
  supabaseSessionCookieName = cookies.find(item => item.name.startsWith("sb-"))?.name;
  assert(supabaseSessionCookieName, "Supabase session cookies were not created.");
  await page.getByRole("banner").getByText("Ahmed Khan", { exact: true }).waitFor();
  await page.getByRole("banner").getByText("Owner", { exact: true }).waitFor();
  await page.reload();
  assert(new URL(page.url()).pathname === "/dashboard", "Refresh did not preserve the authenticated page.");
});

await check("Authenticated users are redirected away from login", async () => {
  await page.goto(`${baseURL}/login`);
  await page.waitForURL(`${baseURL}/dashboard`);
});

const navigation = [
  ["Dashboard", "/dashboard"],
  ["Leads", "/leads"],
  ["Follow-ups", "/follow-ups"],
  ["Appointments", "/appointments"],
  ["Reports", "/reports"],
  ["Team", "/team"],
  ["Settings", "/settings"],
];
await check("All sidebar routes and active states work", async () => {
  for (const [label, path] of navigation) {
    const link = page.getByRole("link", { name: label, exact: true }).first();
    await link.click();
    await page.waitForURL(`${baseURL}${path}`);
    assert((await link.getAttribute("class"))?.includes("bg-blue-600"), `${label} was not marked active.`);
  }
});

await check("Browser back and forward navigation works", async () => {
  await page.getByRole("link", { name: "Dashboard", exact: true }).first().click();
  await page.waitForURL(`${baseURL}/dashboard`);
  await page.getByRole("link", { name: "Leads", exact: true }).first().click();
  await page.waitForURL(`${baseURL}/leads`);
  await page.goBack();
  assert(new URL(page.url()).pathname === "/dashboard", "Back navigation failed.");
  await page.goForward();
  await page.waitForURL(`${baseURL}/leads`);
  assert(new URL(page.url()).pathname === "/leads", "Forward navigation failed.");
});

await check("Global search and leads search work", async () => {
  await page.goto(`${baseURL}/dashboard`);
  await page.getByLabel("Global lead search").fill("Ali Raza");
  await page.getByLabel("Global lead search").press("Enter");
  await page.waitForURL(/\/leads\?search=Ali/);
  await page.getByRole("link", { name: "Ali Raza", exact: true }).waitFor();
  await page.getByLabel("Search leads").fill("no-result-expected");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByText("No leads found").last().waitFor();
  await page.getByRole("link", { name: "Clear filters" }).click();
});

await check("Every lead filter, sort, and clear action works", async () => {
  await page.goto(`${baseURL}/leads`);
  const nextHref = await page.getByRole("link", { name: "Next" }).getAttribute("href");
  assert(nextHref?.includes("page=2"), "Pagination link did not target page two.");
  await page.goto(new URL(nextHref, baseURL).toString());
  await page.getByText("Page 2 of 2", { exact: true }).waitFor();
  assert(new URL(page.url()).searchParams.get("page") === "2", "Pagination URL did not advance to page two.");
  assert(await page.locator("tbody tr").count() === 10, "Second database page did not contain ten leads.");
  await page.goto(`${baseURL}/leads`);
  await page.getByLabel("Filter by status").selectOption("hot");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByText("8 accessible leads", { exact: true }).waitFor();
  assert(await page.locator("tbody tr").count() > 0, "Status filter returned no rows.");
  await page.goto(`${baseURL}/leads`);
  await page.getByLabel("Filter by source").selectOption("Referral");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByText("3 accessible leads", { exact: true }).waitFor();
  assert(new URL(page.url()).searchParams.get("source") === "Referral", "Source filter was not preserved in the URL.");
  assert(await page.locator("tbody tr").count() > 0, "Source filter returned no rows.");
  await page.goto(`${baseURL}/leads`);
  await page.getByLabel("Filter by salesperson").selectOption({ label: "Sara Malik" });
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByText("5 accessible leads", { exact: true }).waitFor();
  assert(await page.locator("tbody tr").count() > 0, "Salesperson filter returned no rows.");
  await page.goto(`${baseURL}/leads`);
  await page.getByLabel("Filter by stage").selectOption("converted");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByText("4 accessible leads", { exact: true }).waitFor();
  assert(await page.locator("tbody tr").count() === 4, "Pipeline stage filter was inconsistent with initial data.");
  await page.goto(`${baseURL}/leads`);
  await page.getByLabel("Sort leads").selectOption("budget");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.locator("tbody tr").first().getByText("Sana Tariq").waitFor();
});

await check("Initial dashboard, reports, trend, team, and currency totals are consistent", async () => {
  await page.goto(`${baseURL}/dashboard`);
  assert((await page.getByText("Total Leads", { exact: true }).locator("..").textContent())?.includes("20"), "Dashboard does not show 20 database leads.");
  await page.getByText("Pipeline Value", { exact: true }).waitFor();
  assert((await page.getByText("Pipeline Value", { exact: true }).locator("..").textContent())?.includes("Rs 66 Crore"), "Dashboard pipeline currency is not in Crore format.");

  await page.goto(`${baseURL}/reports`);
  await page.getByText("Total leads", { exact: true }).waitFor();
  assert((await page.getByText("Total leads", { exact: true }).locator("..").textContent())?.includes("20"), "Default report total does not match dashboard.");
  assert((await page.getByText("Conversion rate", { exact: true }).locator("..").textContent())?.includes("20%"), "Conversion rate should be 20%.");
  assert((await page.getByText("Active pipeline value", { exact: true }).locator("..").textContent())?.includes("Rs 66 Crore"), "Report pipeline does not match dashboard.");
  assert((await page.getByText("Top performer", { exact: true }).locator("..").textContent())?.includes("Hira"), "Top performer was not derived correctly.");
  const trendText = await page.getByText("Monthly lead trend", { exact: true }).locator("..").textContent();
  for (const expected of ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]) {
    assert(trendText?.includes(expected), `Monthly trend is missing ${expected}.`);
  }
  await page.getByLabel("Start date").fill("2026-07-01");
  await page.getByLabel("End date").fill("2026-07-31");
  await page.getByRole("button", { name: "Apply date range" }).click();
  assert((await page.getByText("Total leads", { exact: true }).locator("..").textContent())?.includes("4"), "July date filter should return four demo leads.");

  await page.goto(`${baseURL}/team`);
  await page.getByText("Accessible leads", { exact: true }).waitFor();
  const snapshot = await page.getByText("Accessible leads", { exact: true }).locator("..").locator("..").locator("..").textContent();
  assert(snapshot?.includes("20Accessible leads"), "Team lead total does not equal 20.");
  assert(snapshot?.includes("4Converted leads"), "Team conversion total does not equal four.");
  assert(snapshot?.includes("Rs 66 Crore"), "Team demo pipeline does not match dashboard and reports.");
  for (const name of ["Ahmed Khan", "Sara Malik", "Usman Ali", "Hira Shah"]) {
    const card = page.getByRole("heading", { name, exact: true }).locator("..");
    assert((await card.textContent())?.includes("5Assigned"), `${name} does not show five assigned leads.`);
  }
});

await check("Owner settings, catalogs, scoring validation, preferences, and profile updates work", async () => {
  await page.goto(`${baseURL}/settings`);
  assert(await page.getByLabel("Company name").inputValue() === "Prime Build & Properties", "Seeded company name was inconsistent.");
  assert(await page.getByLabel("Business email").inputValue() === "hello@primebuild.pk", "Seeded business email was inconsistent.");
  assert(!(await page.getByLabel("Company name").isDisabled()), "Owner company settings were read-only.");

  await page.getByRole("button", { name: "Services & sources" }).click();
  await page.getByRole("heading", { name: "Services and lead sources" }).waitFor();
  assert(await page.getByLabel("Services item 1").isEditable(), "Owner could not edit service catalogs.");
  await page.goto(`${baseURL}/leads/new`);
  await page.getByLabel(/Service required/).selectOption("Complete House Construction");
  await page.getByLabel(/Lead source/).selectOption("Website");

  await page.goto(`${baseURL}/settings`);
  await page.getByRole("button", { name: "Lead scoring" }).click();
  await page.getByLabel("Budget fit weight").fill("31");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText(/Scoring weights must total 100/).waitFor();
  await page.getByLabel("Budget fit weight").fill("30");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Company settings saved.").waitFor();

  const settingsNavigation = page.getByRole("navigation", { name: "Settings sections" });
  await settingsNavigation.getByRole("button", { name: "Notifications", exact: true }).click();
  const personalLead = page.getByLabel("My New lead assigned");
  const originalPersonalLead = await personalLead.isChecked();
  await personalLead.click();
  assert(await personalLead.isChecked() === !originalPersonalLead, "Personal notification checkbox did not update.");
  await page.getByRole("button", { name: "Save my preferences" }).click();
  await page.getByText("Notification preferences saved.").waitFor();
  await page.reload();
  await settingsNavigation.getByRole("button", { name: "Notifications", exact: true }).click();
  assert(await page.getByLabel("My New lead assigned").isChecked() === !originalPersonalLead, "Personal notification preference did not persist.");
  await page.getByLabel("My New lead assigned").click();
  await page.getByRole("button", { name: "Save my preferences" }).click();
  await page.getByText("Notification preferences saved.").waitFor();

  await page.getByRole("button", { name: "My profile" }).click();
  await page.getByLabel("Full name").fill("Ahmed Khan QA");
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.getByText("Profile updated.").waitFor();
  await page.reload();
  await page.getByRole("banner").getByText("Ahmed Khan QA", { exact: true }).waitFor();
  await page.getByRole("button", { name: "My profile" }).click();
  await page.getByLabel("Full name").fill("Ahmed Khan");
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.getByText("Profile updated.").waitFor();
  await page.getByRole("banner").getByText("Ahmed Khan", { exact: true }).waitFor();
});

await check("AI is disabled by default and owner-controlled settings persist", async () => {
  await page.goto(`${baseURL}/leads/LP-1001`);
  await page.getByRole("heading", { name: "AI Lead Intelligence" }).waitFor();
  await page.getByRole("heading", { name: "AI assistance is disabled" }).waitFor();
  await page.goto(`${baseURL}/settings`);
  await page.getByRole("button", { name: "AI assistance" }).click();
  assert(!(await page.getByLabel("Enable AI assistance").isChecked()), "Company AI was not disabled by default.");
  await page.getByLabel("Acknowledge AI data minimization").check();
  await page.getByLabel("Enable AI assistance").check();
  await page.getByLabel("Regeneration cooldown (minutes)").fill("0");
  await page.getByRole("button", { name: "Save AI settings" }).click();
  await page.getByText("AI settings saved.").waitFor();
  await page.reload();
  await page.getByRole("button", { name: "AI assistance" }).click();
  assert(await page.getByLabel("Enable AI assistance").isChecked(), "Enabled AI setting did not persist.");
  assert(await page.getByLabel("Acknowledge AI data minimization").isChecked(), "Data-minimization acknowledgment did not persist.");
});

await check("Mock AI generation, copy, explicit score apply, stale state, and versioning work", async () => {
  await page.goto(`${baseURL}/leads/LP-1001`);
  await page.getByRole("button", { name: "Generate Insight" }).click();
  await page.getByText("Mock AI insight generated for testing.").waitFor();
  await page.getByText("Mock / test mode", { exact: true }).waitFor();
  await page.getByText("Recommended next action", { exact: true }).waitFor();
  await page.getByText("Review before sending. AI-generated content may contain mistakes.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Copy suggested reply" }).click();
  assert((await page.evaluate(() => navigator.clipboard.readText())).length > 0, "Suggested reply was not copied.");
  const applyScore = page.getByRole("button", { name: "Apply Score Recommendation" });
  assert(!(await applyScore.isDisabled()), "Mock score recommendation did not differ from the official score.");
  await applyScore.click();
  const confirmation = page.getByRole("alertdialog", { name: "Confirm AI recommendation" });
  await confirmation.getByRole("button", { name: "Confirm apply" }).click();
  await page.getByText("AI score recommendation applied.").waitFor();
  await page.getByText("Insight is stale.").waitFor();
  assert(await page.getByRole("button", { name: "Apply Score Recommendation" }).isDisabled(), "A stale recommendation remained applicable.");
  await page.getByRole("button", { name: "Regenerate" }).click();
  await page.getByText("Insight is stale.").waitFor({ state: "hidden" });
  await page.getByText("Mock / test mode", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("Mock / test mode", { exact: true }).waitFor();
  assert(await page.getByText("Generated", { exact: false }).count() > 0, "Persisted insight metadata was unavailable after refresh.");
});

const longLeadName = "Muhammad Abdullah Khan Construction Holdings";
let createdLeadUrl;
await check("New-lead validation, database creation, and refresh persistence work", async () => {
  await page.goto(`${baseURL}/leads`);
  await page.getByRole("link", { name: "Add lead" }).click();
  await page.getByRole("button", { name: "Save lead" }).click();
  await page.getByText("Enter a full name between 3 and 160 characters.").waitFor();
  await page.getByLabel(/Full name/).fill(longLeadName);
  await page.getByLabel(/Phone number/).fill("03001234567");
  await page.getByLabel("Email address").fill("qa.lead@example.com");
  await page.getByLabel(/Service required/).selectOption("Complete House Construction");
  await page.getByLabel(/Location/).fill("DHA Phase 9 Prism, Lahore — Sector Q");
  await page.getByLabel(/Property size/).fill("2 Kanal");
  await page.getByLabel(/Estimated budget/).fill("50000000");
  await page.getByLabel(/Expected starting timeline/).selectOption("Within 1 month");
  await page.getByLabel(/Lead source/).selectOption("Website");
  await page.getByLabel(/Assigned salesperson/).selectOption({ label: "Ahmed Khan" });
  await page.getByLabel("Notes").fill("[mock:error] QA-created lead used to verify safe provider failure.");
  await page.getByRole("button", { name: "Save lead" }).click();
  await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/);
  createdLeadUrl = page.url();
  await page.getByRole("heading", { name: longLeadName }).waitFor();
  await page.getByText("+92 300 1234567", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: longLeadName }).waitFor();
});

await check("Mock provider failure is safe and leaves the lead unchanged", async () => {
  assert(createdLeadUrl, "Created lead URL was unavailable.");
  await page.getByRole("button", { name: "Generate Insight" }).click();
  await page.getByText("The AI insight could not be generated. The lead was not changed.").waitFor();
  await page.getByRole("heading", { name: "Insight generation failed" }).waitFor();
  await page.getByRole("heading", { name: longLeadName }).waitFor();
});

await check("Lead edit, activity, conversion, and database workflow actions remain consistent", async () => {
  assert(createdLeadUrl, "Created lead URL was unavailable.");
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Notes").fill("QA lead updated through the optimistic database workflow.");
  await page.getByLabel("Assigned member").selectOption({ label: "Sara Malik" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Lead updated successfully.").waitFor();
  await page.getByText("Lead assignment changed", { exact: true }).waitFor();
  await page.getByText("Lead details updated", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Mark converted" }).click();
  await page.getByRole("button", { name: "Converted" }).waitFor();
  await page.getByText("Lead converted", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Follow-up" }).click();
  await page.getByLabel("Date and time").fill("2026-08-05T09:30");
  await page.getByRole("button", { name: "Confirm schedule" }).click();
  await page.getByText("Follow-up scheduled", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Site visit" }).click();
  await page.getByLabel("Date and time").fill("2026-08-06T11:00");
  await page.getByLabel("Location").fill("DHA Phase 9 Prism, Lahore");
  await page.getByRole("button", { name: "Confirm schedule" }).click();
  await page.getByText("Site visit scheduled", { exact: true }).waitFor();
  const state = await page.evaluate(() => ({
    oldLeadStore: localStorage.getItem("leadpilot-demo-leads"),
    oldAppointments: localStorage.getItem("leadpilot-demo-appointments"),
    oldCompleted: localStorage.getItem("leadpilot-demo-completed-followups"),
    oldScheduled: localStorage.getItem("leadpilot-demo-scheduled-followups"),
  }));
  assert(state.oldLeadStore === null, "Retired lead localStorage key was recreated.");
  assert(state.oldAppointments === null && state.oldCompleted === null && state.oldScheduled === null, "Retired workflow localStorage keys were recreated.");
  await page.goto(`${baseURL}/appointments`);
  await page.getByText(longLeadName, { exact: true }).waitFor();
});

await check("Real follow-up and appointment transitions persist after refresh", async () => {
  await page.goto(`${baseURL}/follow-ups`);
  const followCard = page.getByRole("link", { name: longLeadName }).locator("..").locator("..").locator("..");
  await followCard.getByRole("button", { name: /Reschedule/ }).click();
  await page.getByLabel("Due date and time").fill("2026-08-07T10:15");
  await page.getByRole("button", { name: "Save schedule" }).click();
  await page.getByText("Follow-up rescheduled.").waitFor();
  await page.reload();
  const refreshedFollowCard = page.getByRole("link", { name: longLeadName }).locator("..").locator("..").locator("..");
  await refreshedFollowCard.getByRole("button", { name: /Complete/ }).click();
  await page.getByText("Follow-up completed.").waitFor();

  await page.goto(`${baseURL}/appointments`);
  const appointmentCard = page.getByRole("link", { name: longLeadName }).locator("..").locator("..");
  await appointmentCard.getByRole("button", { name: /Confirm/ }).click();
  await page.getByText("Appointment confirmed.").waitFor();
  await page.reload();
  const confirmedCard = page.getByRole("link", { name: longLeadName }).locator("..").locator("..");
  await confirmedCard.getByRole("button", { name: /Complete/ }).click();
  await page.getByText("Appointment completed.").waitFor();
});

await check("Lead, assignment, follow-up, and appointment events create notifications", async () => {
  await page.goto(`${baseURL}/dashboard`);
  const trigger = page.getByRole("button", { name: /Notifications/ });
  assert((await trigger.getAttribute("aria-label"))?.includes("unread"), "Unread notification count was missing after business events.");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Recent notifications" });
  const relatedNotification = dialog.locator("article", { hasText: longLeadName }).first();
  await relatedNotification.waitFor();
  await relatedNotification.getByRole("link").click();
  await page.waitForURL(/\/leads\//);
  await page.goto(`${baseURL}/dashboard`);
  await page.getByRole("button", { name: /Notifications/ }).click();
  assert(await page.getByRole("dialog", { name: "Recent notifications" }).locator("article", { hasText: longLeadName }).first().getByRole("button").isDisabled(), "Related notification was not marked read.");
});

await check("Owner can create and cancel a standalone consultation", async () => {
  await page.goto(`${baseURL}/appointments`);
  await page.getByRole("button", { name: "New appointment" }).click();
  const appointmentDialog = page.getByRole("dialog");
  await appointmentDialog.getByLabel("Customer name").fill("QA Standalone Consultation");
  await appointmentDialog.locator('select[name="type"]').selectOption("consultation");
  await appointmentDialog.getByLabel("Starts").fill("2026-08-09T15:00");
  await appointmentDialog.getByLabel("Location").fill("Blue Area office");
  await appointmentDialog.getByLabel("Assigned member").selectOption({ label: "Sara Malik" });
  await appointmentDialog.getByRole("button", { name: "Create appointment" }).click();
  const card = page.getByRole("heading", { name: "QA Standalone Consultation" }).locator("..");
  await card.waitFor();
  await card.getByRole("button", { name: /Cancel/ }).click();
  await page.getByText("Appointment cancelled.").waitFor();
});

await check("Invalid lead IDs render a graceful state", async () => {
  await page.goto(`${baseURL}/leads/not-a-real-id`);
  await page.getByRole("heading", { name: "Lead not found" }).waitFor();
});

await check("Dashboard and report totals match central lead data", async () => {
  await page.goto(`${baseURL}/dashboard`);
  const totalCard = page.getByText("Total Leads", { exact: true }).locator("..");
  const convertedCard = page.getByText("Converted Clients", { exact: true }).locator("..");
  assert((await totalCard.textContent())?.includes("21"), "Dashboard total did not include the database-created lead.");
  assert((await convertedCard.textContent())?.includes("5"), "Dashboard conversion total did not include the converted lead.");
  await page.goto(`${baseURL}/reports`);
  const reportCard = page.getByText("Total leads", { exact: true }).locator("..");
  assert((await reportCard.textContent())?.includes("21"), "Report total did not match the dashboard database total.");
});

await check("Retired lead and workflow localStorage data is ignored and removed", async () => {
  await page.evaluate(() => {
    localStorage.setItem("leadpilot-demo-leads", "{broken json");
    localStorage.setItem("leadpilot-demo-appointments", "{broken json");
    localStorage.setItem("leadpilot-demo-completed-followups", "[]");
    localStorage.setItem("leadpilot-demo-scheduled-followups", "{}");
  });
  await page.reload();
  await page.goto(`${baseURL}/dashboard`);
  await page.getByText("Total Leads", { exact: true }).waitFor();
  assert(await page.evaluate(() => localStorage.getItem("leadpilot-demo-leads") === null), "Retired lead key was not removed.");
  assert(await page.evaluate(() => [
    "leadpilot-demo-appointments",
    "leadpilot-demo-completed-followups",
    "leadpilot-demo-scheduled-followups",
  ].every(key => localStorage.getItem(key) === null)), "Retired workflow keys were not removed.");
  assert((await page.getByText("Total Leads", { exact: true }).locator("..").textContent())?.includes("21"), "Corrupt browser data affected the database total.");
});

await check("Concurrent authenticated lead creation produces unique company numbers", async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert(url && key, "Public local Supabase configuration is unavailable.");
  const clients = [0, 1].map(() => createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
  await Promise.all(clients.map(client => client.auth.signInWithPassword(accounts.owner)));
  const emails = ["qa.concurrent.one@example.com", "qa.concurrent.two@example.com"];
  const calls = clients.map((client, index) => client.rpc("create_lead", {
    target_company_id: "10000000-0000-0000-0000-000000000001",
    request_id: crypto.randomUUID(),
    lead_full_name: `Concurrent QA Lead ${index + 1}`,
    lead_phone: `+92 300 55500${index + 1}1`,
    lead_email: emails[index],
    lead_service: "Renovation",
    lead_location: "Islamabad",
    lead_property_size: "10 Marla",
    lead_budget_pkr: 1000000,
    lead_expected_timeline: "Within 3 months",
    lead_source: "Website",
    lead_assigned_member_id: "20000000-0000-0000-0000-000000000001",
    lead_score: 60,
    lead_temperature: "warm",
    lead_notes: "Concurrent numbering QA fixture",
  }));
  const results = await Promise.all(calls);
  assert(results.every(result => !result.error && result.data), `Concurrent creation failed: ${results.map(result => result.error?.message).filter(Boolean).join("; ")}`);
  const { data, error } = await clients[0].from("leads").select("lead_number").in("id", results.map(result => result.data));
  assert(!error && data?.length === 2, "Concurrent lead results could not be read.");
  assert(new Set(data.map(item => item.lead_number)).size === 2, "Concurrent lead numbers were duplicated.");
  await page.goto(`${baseURL}/dashboard`);
  await page.getByRole("button", { name: /Notifications/ }).click();
  await page.getByRole("button", { name: "Mark all notifications read" }).click();
  await page.getByRole("dialog", { name: "Recent notifications" }).waitFor({ state: "hidden" });
  assert(await page.getByRole("button", { name: "Notifications", exact: true }).isVisible(), "Unread badge did not clear after marking all read.");
});

await check("All requested routes are responsive at 390px, 430px, and 820px", async () => {
  const responsiveRoutes = [
    "/dashboard", "/leads", "/leads/new", "/leads/LP-1001",
    "/follow-ups", "/appointments", "/reports", "/team", "/settings",
  ];
  for (const width of [390, 430, 820]) {
    await page.setViewportSize({ width, height: width === 820 ? 1180 : 900 });
    for (const route of responsiveRoutes) {
      await page.goto(`${baseURL}${route}`);
      await page.waitForURL(`${baseURL}${route}`);
      const scrollX = await page.evaluate(() => {
        window.scrollTo(1000, 0);
        const value = window.scrollX;
        window.scrollTo(0, 0);
        return value;
      });
      assert(scrollX === 0, `${route} scrolled horizontally by ${scrollX}px at ${width}px.`);
    }
    await page.goto(`${baseURL}/dashboard`);
    if (width < 768) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("link", { name: "Leads", exact: true }).click();
      await page.waitForURL(`${baseURL}/leads`);
    } else {
      assert(await page.getByRole("link", { name: "Dashboard", exact: true }).first().isVisible(), "Tablet sidebar is not visible.");
    }
    await page.goto(`${baseURL}/leads`);
    await page.getByLabel("Filter by status").last().waitFor();
    assert(await page.getByLabel("Filter by status").last().isVisible(), `Filters are not usable at ${width}px.`);
    await page.goto(`${baseURL}/appointments`);
    await page.getByRole("button", { name: "New appointment" }).click();
    const dialog = page.getByRole("dialog");
    const dialogBox = await dialog.boundingBox();
    assert(dialogBox && dialogBox.width <= width, `Dialog exceeds ${width}px viewport.`);
    await page.keyboard.press("Escape");
    await page.goto(`${baseURL}/settings`);
    await page.getByRole("button", { name: /Notifications/ }).first().click();
    const notificationDialog = page.getByRole("dialog", { name: "Recent notifications" });
    const notificationBox = await notificationDialog.boundingBox();
    assert(notificationBox && notificationBox.width <= width, `Notification panel exceeds ${width}px viewport.`);
    await page.keyboard.press("Escape");
  }
});

await check("Dialog keyboard focus stays contained and Escape closes", async () => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseURL}/appointments`);
  await page.getByRole("button", { name: "New appointment" }).click();
  const dialog = page.getByRole("dialog");
  assert(await dialog.evaluate(node => node.contains(document.activeElement)), "Dialog did not receive focus.");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
});

await check("Logout clears the session and prevents protected access", async () => {
  await page.goto(`${baseURL}/dashboard`);
  await page.getByRole("button", { name: "Logout" }).click();
  await page.waitForURL(/\/login\?message=signed-out/);
  await page.goBack();
  await page.waitForURL(/\/login/);
  assert(!(await page.getByText("Total Leads", { exact: true }).isVisible()), "Private dashboard remained visible after browser Back.");
  await page.goto(`${baseURL}/dashboard`).catch(() => undefined);
  await page.waitForURL(/\/login\?next=/);
  await context.addCookies([{
    name: supabaseSessionCookieName,
    value: "forged-or-expired-session",
    domain: "localhost",
    path: "/",
  }]);
  await page.goto(`${baseURL}/dashboard`).catch(() => undefined);
  await page.waitForURL(/\/login\?next=/);
});

await check("Representative membership resolves real name and role", async () => {
  const repContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const repPage = await repContext.newPage();
  trackRuntimeErrors(repPage);
  await repPage.goto(`${baseURL}/login`);
  await signIn(repPage, accounts.representative);
  await repPage.waitForURL(`${baseURL}/dashboard`);
  await repPage.getByRole("banner").getByText("Hira Shah", { exact: true }).waitFor();
  await repPage.getByRole("banner").getByText("Sales Representative", { exact: true }).waitFor();
  await repPage.goto(`${baseURL}/leads`);
  await repPage.getByText("5 accessible leads", { exact: true }).waitFor();
  assert(!(await repPage.getByRole("link", { name: "Ali Raza", exact: true }).isVisible()), "Representative could read another member's lead.");
  await repPage.goto(`${baseURL}/leads/LP-1001`);
  await repPage.getByRole("heading", { name: "Lead not found" }).waitFor();
  await repPage.goto(`${baseURL}/leads/LP-1016`);
  await repPage.getByRole("button", { name: "Generate Insight" }).click();
  await repPage.getByText("Mock AI insight generated for testing.").waitFor();
  await repPage.goto(`${baseURL}/follow-ups`);
  await repPage.getByRole("heading", { name: "Follow-ups" }).waitFor();
  await repPage.getByRole("button", { name: "New follow-up" }).click();
  assert(await repPage.getByLabel("Assigned member").isDisabled(), "Representative could choose another follow-up assignee.");
  assert(await repPage.getByLabel("Lead").locator("option").count() === 6, "Representative follow-up lead options were not scoped to five assigned leads.");
  await repPage.keyboard.press("Escape");
  await repPage.goto(`${baseURL}/appointments`);
  await repPage.getByRole("button", { name: "New appointment" }).click();
  assert(await repPage.getByLabel("Assigned member").isDisabled(), "Representative could choose another appointment assignee.");
  assert(await repPage.getByLabel("Linked lead").locator("option").count() === 6, "Representative appointment lead options were not scoped to five assigned leads.");
  await repPage.keyboard.press("Escape");
  await repPage.goto(`${baseURL}/team`);
  await repPage.getByRole("heading", { name: "Hira Shah", exact: true }).waitFor();
  assert(await repPage.getByRole("heading", { level: 2 }).count() === 1, "Representative could view peer memberships.");
  assert(!(await repPage.getByRole("button", { name: "Invite member" }).isVisible()), "Representative received invitation controls.");
  await repPage.goto(`${baseURL}/settings`);
  assert(await repPage.getByLabel("Company name").isDisabled(), "Representative could edit company settings.");
  await repPage.getByRole("button", { name: "My profile" }).click();
  assert(await repPage.getByLabel("Full name").isEditable(), "Representative could not edit their own profile.");
  await repContext.close();
});

await check("Server-side company quota returns a safe UI error", async () => {
  const quotaContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const quotaPage = await quotaContext.newPage();
  trackRuntimeErrors(quotaPage);
  await quotaPage.goto(`${baseURL}/login`);
  await signIn(quotaPage, accounts.owner);
  await quotaPage.waitForURL(`${baseURL}/dashboard`);
  await quotaPage.goto(`${baseURL}/settings`);
  await quotaPage.getByRole("button", { name: "AI assistance" }).click();
  await quotaPage.getByLabel("Daily company request limit").fill("4");
  await quotaPage.getByLabel("Monthly company request limit").fill("4");
  await quotaPage.getByRole("button", { name: "Save AI settings" }).click();
  await quotaPage.getByText("AI settings saved.").waitFor();
  await quotaPage.goto(`${baseURL}/leads/LP-1003`);
  await quotaPage.getByRole("button", { name: "Generate Insight" }).click();
  await quotaPage.getByText("The configured AI request limit has been reached.").waitFor();
  await quotaPage.getByRole("heading", { name: "No AI insight generated" }).waitFor();
  await quotaContext.close();
});

await check("Tenant preference is membership-validated and switchable", async () => {
  const tenantContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const tenantPage = await tenantContext.newPage();
  trackRuntimeErrors(tenantPage);
  await tenantPage.goto(`${baseURL}/login`);
  await signIn(tenantPage, accounts.owner);
  await tenantPage.waitForURL(`${baseURL}/dashboard`);
  const selector = tenantPage.getByLabel("Workspace");
  assert(await selector.locator("option").count() === 2, "Owner did not resolve both tenant memberships.");
  assert(await selector.inputValue() === "10000000-0000-0000-0000-000000000001", "Primary tenant was not selected deterministically.");
  await Promise.all([
    tenantPage.waitForResponse(response => response.request().method() === "POST" && response.url().startsWith(`${baseURL}/dashboard`)),
    selector.selectOption("10000000-0000-0000-0000-000000000002"),
  ]);
  await tenantPage.waitForLoadState("networkidle");
  await tenantPage.goto(`${baseURL}/leads`);
  await tenantPage.getByText("1 accessible leads", { exact: true }).last().waitFor();
  await tenantPage.getByRole("link", { name: "Tenant Isolation Lead", exact: true }).waitFor();
  await tenantPage.goto(`${baseURL}/team`);
  await tenantPage.getByRole("heading", { name: "Isolation Owner", exact: true }).waitFor();
  await tenantPage.goto(`${baseURL}/settings`);
  assert(await tenantPage.getByLabel("Company name").inputValue() === "Isolation Test Company", "Isolation tenant settings were not loaded.");
  await tenantPage.getByRole("button", { name: "Services & sources" }).click();
  await tenantPage.locator('input[value="Isolation Test"]').waitFor();
  await tenantContext.addCookies([{ name: "leadpilot_company", value: "ffffffff-ffff-ffff-ffff-ffffffffffff", domain: "localhost", path: "/" }]);
  await tenantPage.reload();
  assert(await tenantPage.getByLabel("Company name").inputValue() === "Prime Build & Properties", "Invalid tenant cookie was not replaced by an authorized membership.");
  await tenantContext.close();
});

await check("Manager and admin team controls match the approved hierarchy", async () => {
  const managerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const managerPage = await managerContext.newPage();
  trackRuntimeErrors(managerPage);
  await managerPage.goto(`${baseURL}/login`);
  await signIn(managerPage, accounts.manager);
  await managerPage.waitForURL(`${baseURL}/dashboard`);
  await managerPage.goto(`${baseURL}/team`);
  await managerPage.getByText("Invitations", { exact: true }).waitFor();
  assert(!(await managerPage.getByRole("button", { name: "Invite member" }).isVisible()), "Manager received mutation controls.");
  await managerPage.goto(`${baseURL}/settings`);
  await managerPage.getByText("Your role has read-only access to company configuration.").waitFor();
  assert(await managerPage.getByLabel("Company name").isDisabled(), "Manager could edit company settings.");
  await managerPage.getByRole("button", { name: "AI assistance" }).click();
  assert(await managerPage.getByLabel("Enable AI assistance").isDisabled(), "Manager could edit AI settings.");
  await managerContext.close();

  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const adminPage = await adminContext.newPage();
  trackRuntimeErrors(adminPage);
  await adminPage.goto(`${baseURL}/login`);
  await signIn(adminPage, accounts.admin);
  await adminPage.waitForURL(`${baseURL}/dashboard`);
  await adminPage.goto(`${baseURL}/team`);
  await adminPage.getByRole("button", { name: "Invite member" }).waitFor();
  assert(!(await adminPage.getByLabel("Role for Ahmed Khan").isVisible()), "Admin could manage the owner.");
  assert(!(await adminPage.getByLabel("Role for Sara Malik").isVisible()), "Admin could manage their own membership.");
  assert(await adminPage.getByLabel("Role for Hira Shah").isVisible(), "Admin could not manage a representative.");
  await adminPage.goto(`${baseURL}/settings`);
  assert(!(await adminPage.getByLabel("Company name").isDisabled()), "Admin company settings were read-only.");
  await adminPage.getByRole("button", { name: "Save changes" }).click();
  await adminPage.getByText("Company settings saved.").waitFor();
  await adminContext.close();
});

await check("Invitation is emailed, email-bound, atomic, and single-use", async () => {
  const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const ownerPage = await ownerContext.newPage();
  trackRuntimeErrors(ownerPage);
  await ownerPage.goto(`${baseURL}/login`);
  await signIn(ownerPage, accounts.owner);
  await ownerPage.waitForURL(`${baseURL}/dashboard`);
  await ownerPage.goto(`${baseURL}/team`);
  await ownerPage.getByRole("button", { name: "Invite member" }).click();
  const dialog = ownerPage.getByRole("dialog");
  await dialog.getByLabel("Business email").fill(accounts.invitee.email);
  await dialog.getByLabel("Role").selectOption("sales_representative");
  await dialog.getByRole("button", { name: "Send invitation" }).click();
  await ownerPage.getByText("Invitation sent.").waitFor();
  await ownerPage.getByText(accounts.invitee.email, { exact: true }).waitFor();

  let acceptUrl;
  for (let attempt = 0; attempt < 20 && !acceptUrl; attempt += 1) {
    const listing = await fetch("http://127.0.0.1:54324/api/v1/messages").then(response => response.json());
    const message = listing.messages?.find(item => JSON.stringify(item).includes(accounts.invitee.email));
    if (message) {
      const detail = await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`).then(response => response.json());
      acceptUrl = `${detail.Text ?? ""} ${detail.HTML ?? ""}`.match(/http:\/\/localhost:3000\/invitations\/accept\?token=[A-Za-z0-9_-]{43}/)?.[0];
    }
    if (!acceptUrl) await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(acceptUrl, "Mailpit did not capture a usable invitation link.");

  const wrongContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const wrongPage = await wrongContext.newPage();
  trackRuntimeErrors(wrongPage);
  await wrongPage.goto(`${baseURL}/login`);
  await signIn(wrongPage, accounts.representative);
  await wrongPage.waitForURL(`${baseURL}/dashboard`);
  await wrongPage.goto(acceptUrl);
  await wrongPage.getByText(/You are signed in as/).waitFor();
  assert(!(await wrongPage.getByRole("button", { name: "Accept and open workspace" }).isVisible()), "Wrong email could submit acceptance.");
  await wrongContext.close();

  const inviteeContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const inviteePage = await inviteeContext.newPage();
  trackRuntimeErrors(inviteePage);
  await inviteePage.goto(`${baseURL}/login`);
  await signIn(inviteePage, accounts.invitee);
  await inviteePage.getByRole("heading", { name: "No active company membership" }).waitFor();
  await inviteePage.goto(acceptUrl);
  await inviteePage.getByRole("button", { name: "Accept and open workspace" }).click();
  await inviteePage.waitForURL(/\/dashboard\?membership=accepted/);
  await inviteePage.goto(acceptUrl);
  await inviteePage.getByRole("heading", { name: "Invitation unavailable" }).waitFor();
  await inviteeContext.close();
  await ownerContext.close();
});

await check("A user without company membership is denied", async () => {
  const deniedContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const deniedPage = await deniedContext.newPage();
  trackRuntimeErrors(deniedPage);
  await deniedPage.goto(`${baseURL}/login`);
  await signIn(deniedPage, accounts.noMembership);
  await deniedPage.getByRole("heading", { name: "No active company membership" }).waitFor();
  assert(!(await deniedPage.getByText("Total Leads", { exact: true }).isVisible()), "Business UI was rendered without membership.");
  await deniedContext.close();
});

await check("A suspended company membership is denied", async () => {
  const suspendedContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const suspendedPage = await suspendedContext.newPage();
  trackRuntimeErrors(suspendedPage);
  await suspendedPage.goto(`${baseURL}/login`);
  await signIn(suspendedPage, accounts.suspended);
  await suspendedPage.getByRole("heading", { name: "Membership suspended" }).waitFor();
  assert(!(await suspendedPage.getByText("Total Leads", { exact: true }).isVisible()), "Business UI was rendered for suspended membership.");
  await suspendedContext.close();
});

await check("Password reset request and invalid callback states work", async () => {
  const recoveryContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const recoveryPage = await recoveryContext.newPage();
  trackRuntimeErrors(recoveryPage);
  await recoveryPage.goto(`${baseURL}/forgot-password`);
  await recoveryPage.getByLabel("Email address").fill(accounts.owner.email);
  await recoveryPage.getByRole("button", { name: "Send reset link" }).click();
  await recoveryPage.getByText("Check your inbox for password-reset instructions.").waitFor();
  await recoveryPage.goto(`${baseURL}/auth/callback?code=invalid`);
  await recoveryPage.waitForURL(/\/update-password\?error=invalid-or-expired/);
  await recoveryPage.getByRole("heading", { name: "Reset link unavailable" }).waitFor();
  await recoveryContext.close();
});

await check("Authentication pages fit 1440px, 820px, and 390px", async () => {
  const authContext = await browser.newContext();
  const authPage = await authContext.newPage();
  trackRuntimeErrors(authPage);
  for (const width of [1440, 820, 390]) {
    await authPage.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const route of ["/login", "/forgot-password", "/update-password?error=invalid-or-expired"]) {
      await authPage.goto(`${baseURL}${route}`);
      const scrollX = await authPage.evaluate(() => {
        window.scrollTo(1000, 0);
        const value = window.scrollX;
        window.scrollTo(0, 0);
        return value;
      });
      assert(scrollX === 0, `${route} scrolled horizontally by ${scrollX}px at ${width}px.`);
    }
  }
  await authContext.close();
});

await check("No browser console, hydration, or React runtime errors occurred", async () => {
  assert(errors.length === 0, errors.join("\n"));
});

await browser.close();
const failed = results.filter(result => result.status === "FAIL");
console.log(`\n${results.length - failed.length}/${results.length} browser QA checks passed.`);
if (failed.length) process.exit(1);
