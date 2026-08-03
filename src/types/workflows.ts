import type { Database } from "@/types/database";

export type FollowUpStatus = Database["public"]["Enums"]["follow_up_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type AppointmentType = Database["public"]["Enums"]["appointment_type"];
export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

export type FollowUpDto = {
  id: string;
  leadId: string;
  leadNumber: string;
  leadName: string;
  assignedMemberId: string;
  assignedMemberName: string;
  dueAt: string;
  status: FollowUpStatus;
  priority: TaskPriority;
  notes: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentDto = {
  id: string;
  leadId: string | null;
  leadNumber: string | null;
  customerName: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string | null;
  location: string;
  notes: string;
  assignedMemberId: string;
  assignedMemberName: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowMemberOption = {
  id: string;
  name: string;
};

export type WorkflowLeadOption = {
  id: string;
  leadNumber: string;
  name: string;
  location: string;
  assignedMemberId: string;
};

export type WorkflowActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  id?: string;
};

export type WorkflowMetrics = {
  followUpsToday: number;
  overdueFollowUps: number;
  pendingFollowUps: number;
  upcomingAppointments: number;
  upcomingSiteVisits: number;
};

export const priorityLabels: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const appointmentTypeLabels: Record<AppointmentType, string> = {
  site_visit: "Site Visit",
  consultation: "Consultation",
  meeting: "Meeting",
};

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};
