import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listNotifications, countUnreadNotifications } from "@/data-access/repositories/notifications";
import type { AuthContext } from "@/lib/auth";
import type { NotificationCenterData, NotificationDto } from "@/types/settings";

export async function getNotificationCenter(auth: AuthContext): Promise<NotificationCenterData> {
  const client = await createServerSupabaseClient();
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    listNotifications(client, auth.companyId, auth.memberId, 20),
    countUnreadNotifications(client, auth.companyId, auth.memberId),
  ]);
  if (error || countError) return { notifications: [], unreadCount: 0 };
  const notifications: NotificationDto[] = (data ?? []).map(item => ({
    id: item.id,
    type: item.notification_type,
    title: item.title,
    body: item.body,
    createdAt: item.created_at,
    readAt: item.read_at,
    href: item.lead_id ? `/leads/${item.lead_id}`
      : item.follow_up_id ? "/follow-ups"
        : item.appointment_id ? "/appointments" : null,
    payload: item.payload,
  }));
  return { notifications, unreadCount: count ?? 0 };
}
