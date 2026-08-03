"use server";

import { revalidatePath } from "next/cache";
import { requireLeadContext } from "@/data-access/services/lead-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isAppointmentTransition, parseAppointmentForm } from "@/lib/workflow-validation";
import type { WorkflowActionResult } from "@/types/workflows";

function safeError(message = ""): WorkflowActionResult {
  if (message.includes("changed by another user")) return { ok: false, message: "This appointment changed. Reload before saving." };
  if (message.includes("not permitted") || message.includes("cannot reassign") || message.includes("must use")) return { ok: false, message: "Your role does not permit this appointment change." };
  if (message.includes("final") || message.includes("transition")) return { ok: false, message: "That status transition is no longer valid." };
  if (message.includes("lead") || message.includes("assignee")) return { ok: false, message: "Select an accessible lead and active company member." };
  return { ok: false, message: "The appointment could not be saved." };
}

function refresh(leadId?: string | null) {
  ["/appointments", "/dashboard", "/team"].forEach(path => revalidatePath(path));
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

export async function saveAppointmentAction(formData: FormData): Promise<WorkflowActionResult> {
  const parsed = parseAppointmentForm(formData);
  if (!parsed.success) return parsed.result;
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const value = parsed.data;
    const response = value.id
      ? await client.rpc("update_appointment", {
          target_company_id: auth.companyId,
          target_appointment_id: value.id,
          expected_updated_at: value.expectedUpdatedAt ?? "",
          target_customer_name: value.customerName,
          target_appointment_type: value.type,
          target_starts_at: value.startsAt,
          target_ends_at: (value.endsAt ?? null) as unknown as string,
          target_location: value.location,
          target_notes: value.notes,
          target_assigned_member_id: value.assignedMemberId,
        })
      : await client.rpc("create_appointment", {
          target_company_id: auth.companyId,
          request_id: value.requestId ?? crypto.randomUUID(),
          target_lead_id: (value.leadId ?? null) as unknown as string,
          target_customer_name: value.customerName,
          target_appointment_type: value.type,
          target_starts_at: value.startsAt,
          target_ends_at: (value.endsAt ?? null) as unknown as string,
          target_location: value.location,
          target_notes: value.notes,
          target_assigned_member_id: value.assignedMemberId,
        });
    if (response.error) return safeError(response.error.message);
    refresh(value.leadId);
    return { ok: true, message: value.id ? "Appointment rescheduled." : "Appointment created.", id: String(response.data ?? value.id) };
  } catch (error) {
    return safeError(error instanceof Error ? error.message : "");
  }
}

export async function transitionAppointmentAction(id: string, status: string): Promise<WorkflowActionResult> {
  if (!isAppointmentTransition(status)) return { ok: false, message: "Invalid appointment status." };
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const { error } = await client.rpc("transition_appointment", {
      target_company_id: auth.companyId,
      target_appointment_id: id,
      target_status: status,
    });
    if (error) return safeError(error.message);
    refresh();
    return { ok: true, message: `Appointment ${status}.` };
  } catch (error) {
    return safeError(error instanceof Error ? error.message : "");
  }
}

export async function archiveAppointmentAction(id: string, archived: boolean): Promise<WorkflowActionResult> {
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const { error } = await client.rpc("set_appointment_archived", {
      target_company_id: auth.companyId,
      target_appointment_id: id,
      archive_record: archived,
    });
    if (error) return safeError(error.message);
    refresh();
    return { ok: true, message: archived ? "Appointment archived." : "Appointment restored." };
  } catch (error) {
    return safeError(error instanceof Error ? error.message : "");
  }
}
