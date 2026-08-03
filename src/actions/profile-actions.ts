"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireLeadContext } from "@/data-access/services/lead-service";
import { parseProfile } from "@/lib/settings-validation";
import type { SettingsActionResult } from "@/types/settings";

export async function updateProfileAction(formData: FormData): Promise<SettingsActionResult> {
  const parsed = parseProfile(formData);
  if (!parsed.success) return parsed.result;
  try {
    await requireLeadContext();
    const client = await createServerSupabaseClient();
    const { error } = await client.rpc("update_my_profile", {
      expected_updated_at: parsed.data.expectedUpdatedAt,
      profile_full_name: parsed.data.fullName,
      profile_phone: parsed.data.phone,
      profile_timezone: parsed.data.timezone,
    });
    if (error?.message.includes("changed by another")) return { ok: false, message: "Your profile changed in another session. Reload before saving." };
    if (error) return { ok: false, message: "Your profile could not be saved." };
    revalidatePath("/", "layout");
    revalidatePath("/settings");
    return { ok: true, message: "Profile updated." };
  } catch { return { ok: false, message: "Your profile could not be saved." }; }
}
