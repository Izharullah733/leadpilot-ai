"use server";

import { revalidatePath } from "next/cache";
import { requireLeadContext } from "@/data-access/services/lead-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isFollowUpTransition, parseFollowUpForm } from "@/lib/workflow-validation";
import type { WorkflowActionResult } from "@/types/workflows";

function safeError(message = ""): WorkflowActionResult {
  if (message.includes("changed by another user")) return { ok: false, message: "This follow-up changed. Reload before saving." };
  if (message.includes("not permitted") || message.includes("cannot reassign")) return { ok: false, message: "Your role does not permit this follow-up change." };
  if (message.includes("lead") || message.includes("assignee")) return { ok: false, message: "Select an accessible lead and active company member." };
  if (message.includes("final") || message.includes("pending")) return { ok: false, message: "That status transition is no longer valid." };
  return { ok: false, message: "The follow-up could not be saved." };
}

function refresh(id?: string) {
  ["/follow-ups", "/dashboard", "/team"].forEach(path => revalidatePath(path));
  if (id) revalidatePath(`/leads/${id}`);
}

export async function saveFollowUpAction(formData: FormData): Promise<WorkflowActionResult> {
  const parsed = parseFollowUpForm(formData);
  if (!parsed.success) return parsed.result;
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const value = parsed.data;
    const response = value.id
      ? await client.rpc("update_follow_up", {
          target_company_id: auth.companyId,
          target_follow_up_id: value.id,
          expected_updated_at: value.expectedUpdatedAt ?? "",
          target_assigned_member_id: value.assignedMemberId,
          target_due_at: value.dueAt,
          target_priority: value.priority,
          target_notes: value.notes,
        })
      : await client.rpc("create_follow_up", {
          target_company_id: auth.companyId,
          request_id: value.requestId ?? crypto.randomUUID(),
          target_lead_id: value.leadId,
          target_assigned_member_id: value.assignedMemberId,
          target_due_at: value.dueAt,
          target_priority: value.priority,
          target_notes: value.notes,
        });
    if (response.error) return safeError(response.error.message);
    refresh(value.leadId);
    return { ok: true, message: value.id ? "Follow-up rescheduled." : "Follow-up scheduled.", id: String(response.data ?? value.id) };
  } catch (error) {
    return safeError(error instanceof Error ? error.message : "");
  }
}

export async function transitionFollowUpAction(id: string, status: string): Promise<WorkflowActionResult> {
  if (!isFollowUpTransition(status)) return { ok: false, message: "Invalid follow-up status." };
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const { error } = await client.rpc("transition_follow_up", {
      target_company_id: auth.companyId,
      target_follow_up_id: id,
      target_status: status,
    });
    if (error) return safeError(error.message);
    refresh();
    return { ok: true, message: status === "completed" ? "Follow-up completed." : "Follow-up cancelled." };
  } catch (error) {
    return safeError(error instanceof Error ? error.message : "");
  }
}

export async function archiveFollowUpAction(id: string, archived: boolean): Promise<WorkflowActionResult> {
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const { error } = await client.rpc("set_follow_up_archived", {
      target_company_id: auth.companyId,
      target_follow_up_id: id,
      archive_record: archived,
    });
    if (error) return safeError(error.message);
    refresh();
    return { ok: true, message: archived ? "Follow-up archived." : "Follow-up restored." };
  } catch (error) {
    return safeError(error instanceof Error ? error.message : "");
  }
}
