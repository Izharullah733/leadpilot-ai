import type { AppSupabaseClient } from "@/data-access/repositories/membership-repository";

export const notificationColumns =
  "id,notification_type,title,body,lead_id,follow_up_id,appointment_id,payload,read_at,created_at" as const;

export function listNotifications(
  client: AppSupabaseClient,
  companyId: string,
  memberId: string,
  limit = 20,
) {
  return client.from("notifications").select(notificationColumns)
    .eq("company_id", companyId)
    .eq("recipient_member_id", memberId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export function countUnreadNotifications(
  client: AppSupabaseClient,
  companyId: string,
  memberId: string,
) {
  return client.from("notifications").select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("recipient_member_id", memberId)
    .is("read_at", null)
    .is("archived_at", null);
}

export function getNotificationPreferences(
  client: AppSupabaseClient,
  companyId: string,
  memberId: string,
) {
  return client.from("user_notification_preferences").select("preferences,updated_at")
    .eq("company_id", companyId).eq("member_id", memberId).maybeSingle();
}
