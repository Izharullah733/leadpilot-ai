import { isPakistanPhone } from "@/lib/format";
import {
  notificationCategories,
  supportedTimezones,
  type NotificationPreferences,
  type ScoringRules,
  type SettingsActionResult,
} from "@/types/settings";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const unsafePattern = /[<>]/;

function jsonValue<T>(value: FormDataEntryValue | null): T | null {
  try { return JSON.parse(String(value ?? "")) as T; } catch { return null; }
}

function catalog(value: FormDataEntryValue | null) {
  const parsed = jsonValue<unknown>(value);
  if (!Array.isArray(parsed) || !parsed.every(item => typeof item === "string")) return null;
  const cleaned = parsed.map(item => item.trim()).filter(Boolean);
  if (!cleaned.length || cleaned.length > 50 || cleaned.some(item => item.length < 2 || item.length > 100 || unsafePattern.test(item))) return null;
  if (new Set(cleaned.map(item => item.toLowerCase())).size !== cleaned.length) return null;
  return cleaned;
}

function scoring(value: FormDataEntryValue | null): ScoringRules | null {
  const parsed = jsonValue<ScoringRules>(value);
  if (!parsed || parsed.version !== 1 || !parsed.weights || !parsed.budget_thresholds || !Array.isArray(parsed.high_intent_services)) return null;
  const weights = Object.values(parsed.weights);
  if (weights.length !== 5 || weights.some(item => !Number.isInteger(item) || item < 0 || item > 100) || weights.reduce((sum, item) => sum + item, 0) !== 100) return null;
  if (!Number.isInteger(parsed.budget_thresholds.warm_pkr) || !Number.isInteger(parsed.budget_thresholds.hot_pkr) || parsed.budget_thresholds.hot_pkr <= parsed.budget_thresholds.warm_pkr) return null;
  return parsed;
}

function preferenceObject(value: FormDataEntryValue | null): NotificationPreferences | null {
  const parsed = jsonValue<Record<string, unknown>>(value);
  if (!parsed || Object.entries(parsed).some(([key, item]) => !notificationCategories.includes(key as typeof notificationCategories[number]) || typeof item !== "boolean")) return null;
  return parsed as NotificationPreferences;
}

export function parseCompanySettings(formData: FormData) {
  const fields: Record<string, string> = {};
  const name = String(formData.get("name") ?? "").trim();
  const businessEmail = String(formData.get("businessEmail") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "");
  const services = catalog(formData.get("services"));
  const disabledServices = catalog(formData.get("disabledServices")) ?? [];
  const leadSources = catalog(formData.get("leadSources"));
  const disabledLeadSources = catalog(formData.get("disabledLeadSources")) ?? [];
  const scoringRules = scoring(formData.get("scoringRules"));
  const notificationDefaults = preferenceObject(formData.get("notificationDefaults"));
  if (name.length < 2 || name.length > 160 || unsafePattern.test(name)) fields.name = "Enter a company name between 2 and 160 characters.";
  if (businessEmail && !emailPattern.test(businessEmail)) fields.businessEmail = "Enter a valid business email.";
  if (phone.length > 40) fields.phone = "Phone must be 40 characters or fewer.";
  if (city.length > 120 || unsafePattern.test(city)) fields.city = "Enter a valid city.";
  if (address.length > 500 || unsafePattern.test(address)) fields.address = "Address must be 500 characters or fewer.";
  if (!supportedTimezones.includes(timezone as typeof supportedTimezones[number])) fields.timezone = "Select a supported timezone.";
  if (!services) fields.services = "Service names must be unique and non-empty.";
  if (!leadSources) fields.leadSources = "Lead-source names must be unique and non-empty.";
  if (!scoringRules) fields.scoringRules = "Scoring weights must total 100 and use valid thresholds.";
  if (!notificationDefaults) fields.notificationDefaults = "Notification defaults are invalid.";
  if (Object.keys(fields).length) return { success: false as const, result: { ok: false, message: "Correct the highlighted settings.", fieldErrors: fields } as SettingsActionResult };
  return { success: true as const, data: {
    name, businessEmail, phone, city, address, timezone, currency: "PKR",
    services: services!, disabledServices, leadSources: leadSources!, disabledLeadSources,
    scoringRules: scoringRules!, notificationDefaults: notificationDefaults!,
    companyUpdatedAt: String(formData.get("companyUpdatedAt") ?? ""),
    settingsUpdatedAt: String(formData.get("settingsUpdatedAt") ?? ""),
  } };
}

export function parseProfile(formData: FormData) {
  const fields: Record<string, string> = {};
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("profilePhone") ?? "").trim();
  const timezone = String(formData.get("profileTimezone") ?? "");
  if (fullName.length < 2 || fullName.length > 120 || unsafePattern.test(fullName)) fields.fullName = "Enter a name between 2 and 120 characters.";
  if (phone && !isPakistanPhone(phone)) fields.profilePhone = "Use a Pakistani mobile number such as 0300 1234567.";
  if (!supportedTimezones.includes(timezone as typeof supportedTimezones[number])) fields.profileTimezone = "Select a supported timezone.";
  if (Object.keys(fields).length) return { success: false as const, result: { ok: false, message: "Correct the highlighted profile fields.", fieldErrors: fields } as SettingsActionResult };
  return { success: true as const, data: { fullName, phone, timezone, expectedUpdatedAt: String(formData.get("profileUpdatedAt") ?? "") } };
}

export function parsePreferences(formData: FormData) {
  const preferences = preferenceObject(formData.get("preferences"));
  return preferences
    ? { success: true as const, data: preferences }
    : { success: false as const, result: { ok: false, message: "Notification preferences are invalid." } as SettingsActionResult };
}
