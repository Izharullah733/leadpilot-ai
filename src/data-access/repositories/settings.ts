import type { AppSupabaseClient } from "@/data-access/repositories/membership-repository";

export const companyColumns =
  "id,name,business_email,phone,city,address,updated_at" as const;
export const settingsColumns =
  "company_id,timezone,currency,services,disabled_services,lead_sources,disabled_lead_sources,lead_scoring_rules,notification_defaults,ai_settings,updated_at" as const;

export function getCompanyProfile(client: AppSupabaseClient, companyId: string) {
  return client.from("companies").select(companyColumns)
    .eq("id", companyId).is("deleted_at", null).maybeSingle();
}

export function getCompanySettings(client: AppSupabaseClient, companyId: string) {
  return client.from("company_settings").select(settingsColumns)
    .eq("company_id", companyId).maybeSingle();
}
