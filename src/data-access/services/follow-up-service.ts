import "server-only";
import { listFollowUps } from "@/data-access/repositories/follow-ups";
import { getScheduleContext, dateKeyInTimeZone } from "@/data-access/services/schedule-service";
import type { FollowUpDto, WorkflowMetrics } from "@/types/workflows";

export async function getFollowUpData() {
  const context = await getScheduleContext();
  const { data, error } = await listFollowUps(context.client, context.auth.companyId);
  if (error) throw new Error("Follow-ups could not be loaded.");
  const leadMap = new Map(context.leads.map(lead => [lead.id, lead]));
  const memberMap = new Map(context.members.map(member => [member.id, member.name]));
  const followUps: FollowUpDto[] = (data ?? []).map(item => {
    const lead = leadMap.get(item.lead_id);
    return {
      id: item.id,
      leadId: item.lead_id,
      leadNumber: lead?.leadNumber ?? "Restricted lead",
      leadName: lead?.name ?? "Restricted lead",
      assignedMemberId: item.assigned_member_id,
      assignedMemberName: memberMap.get(item.assigned_member_id) ?? "Former member",
      dueAt: item.due_at,
      status: item.status,
      priority: item.priority,
      notes: item.notes ?? "",
      completedAt: item.completed_at,
      cancelledAt: item.cancelled_at,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  });
  const today = dateKeyInTimeZone(new Date(), context.timeZone);
  return {
    ...context,
    followUps,
    today,
    groups: {
      overdue: followUps.filter(item => item.status === "pending" && dateKeyInTimeZone(item.dueAt, context.timeZone) < today),
      today: followUps.filter(item => item.status === "pending" && dateKeyInTimeZone(item.dueAt, context.timeZone) === today),
      upcoming: followUps.filter(item => item.status === "pending" && dateKeyInTimeZone(item.dueAt, context.timeZone) > today),
      completed: followUps.filter(item => item.status === "completed"),
    },
  };
}

export async function getWorkflowMetrics(): Promise<WorkflowMetrics & {
  dueFollowUps: FollowUpDto[];
}> {
  const followData = await getFollowUpData();
  const { data: appointments, error } = await followData.client
    .from("appointments")
    .select("appointment_type,status,starts_at")
    .eq("company_id", followData.auth.companyId)
    .is("deleted_at", null);
  if (error) throw new Error("Workflow metrics could not be loaded.");
  const now = new Date().toISOString();
  const upcoming = (appointments ?? []).filter(item =>
    !["completed", "cancelled"].includes(item.status) && item.starts_at >= now
  );
  return {
    followUpsToday: followData.groups.today.length,
    overdueFollowUps: followData.groups.overdue.length,
    pendingFollowUps: followData.followUps.filter(item => item.status === "pending").length,
    upcomingAppointments: upcoming.length,
    upcomingSiteVisits: upcoming.filter(item => item.appointment_type === "site_visit").length,
    dueFollowUps: [...followData.groups.overdue, ...followData.groups.today].slice(0, 5),
  };
}

export async function getTeamWorkflowMetrics() {
  const data = await getFollowUpData();
  return data.members.map(member => ({
    memberId: member.id,
    followUpsToday: data.groups.today.filter(item => item.assignedMemberId === member.id).length,
    overdueFollowUps: data.groups.overdue.filter(item => item.assignedMemberId === member.id).length,
  }));
}
