import type {
  AppointmentStatus,
  AppointmentType,
  FollowUpStatus,
  TaskPriority,
  WorkflowActionResult,
} from "@/types/workflows";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const priorities = new Set<TaskPriority>(["low", "normal", "high", "urgent"]);
const appointmentTypes = new Set<AppointmentType>(["site_visit", "consultation", "meeting"]);

export type FollowUpInput = {
  id?: string;
  requestId?: string;
  leadId: string;
  assignedMemberId: string;
  dueAt: string;
  priority: TaskPriority;
  notes: string;
  expectedUpdatedAt?: string;
};

export type AppointmentInput = {
  id?: string;
  requestId?: string;
  leadId: string | null;
  customerName: string;
  type: AppointmentType;
  startsAt: string;
  endsAt: string | null;
  location: string;
  notes: string;
  assignedMemberId: string;
  expectedUpdatedAt?: string;
};

function requiredUuid(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return uuidPattern.test(text) ? text : "";
}

function optionalUuid(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? requiredUuid(value) : null;
}

export function localDateTimeToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "";
  const date = new Date(`${value}:00+05:00`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function parseFollowUpForm(formData: FormData):
  | { success: true; data: FollowUpInput }
  | { success: false; result: WorkflowActionResult } {
  const fields: Record<string, string> = {};
  const leadId = requiredUuid(formData.get("leadId"));
  const assignedMemberId = requiredUuid(formData.get("assignedMemberId"));
  const dueAt = localDateTimeToIso(String(formData.get("dueAt") ?? ""));
  const priority = String(formData.get("priority") ?? "") as TaskPriority;
  const notes = String(formData.get("notes") ?? "").trim();
  if (!leadId) fields.leadId = "Select an accessible lead.";
  if (!assignedMemberId) fields.assignedMemberId = "Select an active team member.";
  if (!dueAt) fields.dueAt = "Enter a valid date and time.";
  if (!priorities.has(priority)) fields.priority = "Select a valid priority.";
  if (notes.length > 5000) fields.notes = "Notes must be 5,000 characters or fewer.";
  if (Object.keys(fields).length) {
    return { success: false, result: { ok: false, message: "Correct the highlighted fields.", fieldErrors: fields } };
  }
  return {
    success: true,
    data: {
      id: optionalUuid(formData.get("id")) ?? undefined,
      requestId: requiredUuid(formData.get("requestId")) || undefined,
      leadId,
      assignedMemberId,
      dueAt,
      priority,
      notes,
      expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? "") || undefined,
    },
  };
}

export function parseAppointmentForm(formData: FormData):
  | { success: true; data: AppointmentInput }
  | { success: false; result: WorkflowActionResult } {
  const fields: Record<string, string> = {};
  const leadId = optionalUuid(formData.get("leadId"));
  const customerName = String(formData.get("customerName") ?? "").trim();
  const type = String(formData.get("type") ?? "") as AppointmentType;
  const startsAt = localDateTimeToIso(String(formData.get("startsAt") ?? ""));
  const rawEndsAt = String(formData.get("endsAt") ?? "").trim();
  const endsAt = rawEndsAt ? localDateTimeToIso(rawEndsAt) : null;
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const assignedMemberId = requiredUuid(formData.get("assignedMemberId"));
  if (!leadId && customerName.length < 2) fields.customerName = "Enter a customer name or select a lead.";
  if (!appointmentTypes.has(type)) fields.type = "Select a valid appointment type.";
  if (!startsAt) fields.startsAt = "Enter a valid start date and time.";
  if (rawEndsAt && !endsAt) fields.endsAt = "Enter a valid end date and time.";
  if (startsAt && endsAt && endsAt <= startsAt) fields.endsAt = "End time must be after the start time.";
  if (!assignedMemberId) fields.assignedMemberId = "Select an active team member.";
  if (location.length > 500) fields.location = "Location must be 500 characters or fewer.";
  if (notes.length > 5000) fields.notes = "Notes must be 5,000 characters or fewer.";
  if (Object.keys(fields).length) {
    return { success: false, result: { ok: false, message: "Correct the highlighted fields.", fieldErrors: fields } };
  }
  return {
    success: true,
    data: {
      id: optionalUuid(formData.get("id")) ?? undefined,
      requestId: requiredUuid(formData.get("requestId")) || undefined,
      leadId,
      customerName,
      type,
      startsAt,
      endsAt,
      location,
      notes,
      assignedMemberId,
      expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? "") || undefined,
    },
  };
}

export function isFollowUpTransition(value: string): value is FollowUpStatus {
  return value === "completed" || value === "cancelled";
}

export function isAppointmentTransition(value: string): value is AppointmentStatus {
  return value === "confirmed" || value === "completed" || value === "cancelled";
}
