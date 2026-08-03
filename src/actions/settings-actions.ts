"use server";

import { revalidatePath } from "next/cache";
import { requireLeadContext } from "@/data-access/services/lead-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseCompanySettings } from "@/lib/settings-validation";
import type { Json } from "@/types/database";
import type { SettingsActionResult } from "@/types/settings";

function safeError(message = ""): SettingsActionResult {
  if (message.includes("changed by another")) return { ok: false, message: "Settings changed in another session. Reload before saving." };
  if (message.includes("not permitted")) return { ok: false, message: "Only an owner or admin can change company settings." };
  if (message.includes("cannot be removed")) return { ok: false, message: "A service or source used by existing leads cannot be removed. Disable it instead." };
  return { ok: false, message: "Company settings could not be saved." };
}

export async function updateCompanySettingsAction(formData: FormData): Promise<SettingsActionResult> {
  const parsed = parseCompanySettings(formData);
  if (!parsed.success) return parsed.result;
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const value = parsed.data;
    const { error } = await client.rpc("update_company_settings", {
      target_company_id: auth.companyId,
      expected_company_updated_at: value.companyUpdatedAt,
      expected_settings_updated_at: value.settingsUpdatedAt,
      company_name: value.name,
      company_business_email: value.businessEmail,
      company_phone: value.phone,
      company_city: value.city,
      company_address: value.address,
      settings_timezone: value.timezone,
      settings_currency: value.currency,
      settings_services: value.services,
      settings_disabled_services: value.disabledServices,
      settings_lead_sources: value.leadSources,
      settings_disabled_lead_sources: value.disabledLeadSources,
      settings_scoring_rules: value.scoringRules as unknown as Json,
      settings_notification_defaults: value.notificationDefaults as Json,
    });
    if (error) return safeError(error.message);
    revalidatePath("/", "layout");
    revalidatePath("/settings");
    revalidatePath("/leads/new");
    return { ok: true, message: "Company settings saved." };
  } catch (error) { return safeError(error instanceof Error ? error.message : ""); }
}
