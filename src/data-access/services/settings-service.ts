import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireLeadContext } from "@/data-access/services/lead-service";
import { getCompanyProfile, getCompanySettings } from "@/data-access/repositories/settings";
import { getProfile } from "@/data-access/repositories/profiles";
import { getNotificationPreferences } from "@/data-access/repositories/notifications";
import type { NotificationPreferences, ScoringRules, SettingsPageData } from "@/types/settings";
import { parseAICompanySettings } from "@/lib/ai/schemas";

export const defaultScoringRules: ScoringRules = {
  version: 1,
  weights: { budget: 30, timeline: 25, source: 15, completeness: 15, service: 15 },
  budget_thresholds: { warm_pkr: 10_000_000, hot_pkr: 30_000_000 },
  high_intent_services: ["Complete House Construction", "Commercial Construction", "Property Purchase"],
};

function scoringRules(value: unknown): ScoringRules {
  if (value && typeof value === "object" && !Array.isArray(value) && "version" in value) {
    return value as ScoringRules;
  }
  return defaultScoringRules;
}

function preferences(value: unknown): NotificationPreferences {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as NotificationPreferences : {};
}

export async function getSettingsPageData(): Promise<SettingsPageData> {
  const auth = await requireLeadContext();
  const client = await createServerSupabaseClient();
  const [{ data: company, error: companyError }, { data: settings, error: settingsError },
    { data: profile, error: profileError }, { data: userPreferences, error: preferenceError },
    { data: user }] = await Promise.all([
      getCompanyProfile(client, auth.companyId),
      getCompanySettings(client, auth.companyId),
      getProfile(client, auth.profileId),
      getNotificationPreferences(client, auth.companyId, auth.memberId),
      client.auth.getUser(),
    ]);
  if (companyError || settingsError || profileError || preferenceError || !company || !settings || !profile) {
    throw new Error("Settings could not be loaded.");
  }
  return {
    auth,
    company: {
      companyId: company.id,
      name: company.name,
      businessEmail: company.business_email ?? "",
      phone: company.phone ?? "",
      city: company.city ?? "",
      address: company.address ?? "",
      timezone: settings.timezone,
      currency: settings.currency,
      services: settings.services,
      disabledServices: settings.disabled_services,
      leadSources: settings.lead_sources,
      disabledLeadSources: settings.disabled_lead_sources,
      scoringRules: scoringRules(settings.lead_scoring_rules),
      notificationDefaults: preferences(settings.notification_defaults),
      aiSettings: parseAICompanySettings(settings.ai_settings),
      companyUpdatedAt: company.updated_at,
      settingsUpdatedAt: settings.updated_at,
    },
    profile: {
      id: profile.id,
      fullName: profile.full_name,
      email: user.user?.email ?? "",
      phone: profile.phone ?? "",
      timezone: profile.timezone,
      avatarUrl: profile.avatar_url,
      updatedAt: profile.updated_at,
    },
    preferences: preferences(userPreferences?.preferences),
  };
}

export async function getEnabledLeadCatalogs() {
  const auth = await requireLeadContext();
  const client = await createServerSupabaseClient();
  const { data, error } = await getCompanySettings(client, auth.companyId);
  if (error || !data) throw new Error("Company lead options could not be loaded.");
  return {
    services: data.services.filter(item => !data.disabled_services.includes(item)),
    sources: data.lead_sources.filter(item => !data.disabled_lead_sources.includes(item)),
  };
}
