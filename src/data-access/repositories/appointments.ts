import type { AppSupabaseClient } from "@/data-access/repositories/membership-repository";
import type { AppointmentStatus, AppointmentType } from "@/types/workflows";

export const appointmentColumns =
  "id,lead_id,customer_name,appointment_type,status,starts_at,ends_at,location,notes,assigned_member_id,completed_at,cancelled_at,created_at,updated_at" as const;

export function listAppointments(
  client: AppSupabaseClient,
  companyId: string,
  filters?: { type?: AppointmentType; status?: AppointmentStatus },
  limit = 200,
) {
  let query = client
    .from("appointments")
    .select(appointmentColumns)
    .eq("company_id", companyId)
    .is("deleted_at", null);
  if (filters?.type) query = query.eq("appointment_type", filters.type);
  if (filters?.status) query = query.eq("status", filters.status);
  return query.order("starts_at", { ascending: true }).limit(limit);
}

export function getAppointment(
  client: AppSupabaseClient,
  companyId: string,
  appointmentId: string,
) {
  return client
    .from("appointments")
    .select(appointmentColumns)
    .eq("company_id", companyId)
    .eq("id", appointmentId)
    .is("deleted_at", null)
    .maybeSingle();
}
