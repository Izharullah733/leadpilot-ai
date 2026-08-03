"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireLeadContext } from "@/data-access/services/lead-service";
import { parsePreferences } from "@/lib/settings-validation";
import type { Json } from "@/types/database";
import type { SettingsActionResult } from "@/types/settings";

function refresh() { revalidatePath("/", "layout"); revalidatePath("/settings"); }

export async function updateNotificationPreferencesAction(formData: FormData): Promise<SettingsActionResult> {
  const parsed = parsePreferences(formData);
  if (!parsed.success) return parsed.result;
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const { error } = await client.rpc("update_my_notification_preferences", {
      target_company_id: auth.companyId,
      requested_preferences: parsed.data as Json,
    });
    if (error) return { ok: false, message: "Notification preferences could not be saved." };
    refresh(); return { ok: true, message: "Notification preferences saved." };
  } catch { return { ok: false, message: "Notification preferences could not be saved." }; }
}

export async function markNotificationReadAction(id: string): Promise<SettingsActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Invalid notification." };
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("mark_notification_read", { target_company_id: auth.companyId, target_notification_id: id });
    if (error || !data) return { ok: false, message: "Notification could not be updated." };
    refresh(); return { ok: true, message: "Notification marked read." };
  } catch { return { ok: false, message: "Notification could not be updated." }; }
}

export async function markAllNotificationsReadAction(): Promise<SettingsActionResult> {
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const { error } = await client.rpc("mark_all_notifications_read", { target_company_id: auth.companyId });
    if (error) return { ok: false, message: "Notifications could not be updated." };
    refresh(); return { ok: true, message: "All notifications marked read." };
  } catch { return { ok: false, message: "Notifications could not be updated." }; }
}
