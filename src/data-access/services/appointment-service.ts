import "server-only";
import { listAppointments } from "@/data-access/repositories/appointments";
import { getScheduleContext } from "@/data-access/services/schedule-service";
import type { AppointmentDto, AppointmentStatus, AppointmentType } from "@/types/workflows";

export async function getAppointmentData(filters?: {
  type?: AppointmentType;
  status?: AppointmentStatus;
}) {
  const context = await getScheduleContext();
  const { data, error } = await listAppointments(
    context.client,
    context.auth.companyId,
    filters,
  );
  if (error) throw new Error("Appointments could not be loaded.");
  const leadMap = new Map(context.leads.map(lead => [lead.id, lead]));
  const memberMap = new Map(context.members.map(member => [member.id, member.name]));
  const appointments: AppointmentDto[] = (data ?? []).map(item => ({
    id: item.id,
    leadId: item.lead_id,
    leadNumber: item.lead_id ? leadMap.get(item.lead_id)?.leadNumber ?? null : null,
    customerName: item.lead_id ? leadMap.get(item.lead_id)?.name ?? item.customer_name : item.customer_name,
    type: item.appointment_type,
    status: item.status,
    startsAt: item.starts_at,
    endsAt: item.ends_at,
    location: item.location ?? "",
    notes: item.notes ?? "",
    assignedMemberId: item.assigned_member_id,
    assignedMemberName: memberMap.get(item.assigned_member_id) ?? "Former member",
    completedAt: item.completed_at,
    cancelledAt: item.cancelled_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));
  return { ...context, appointments };
}
