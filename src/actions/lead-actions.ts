"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseLeadForm } from "@/lib/lead-validation";
import { requireLeadContext } from "@/data-access/services/lead-service";

export type LeadActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

const initialFailure: LeadActionState = {
  ok: false,
  message: "The lead could not be saved.",
};

function safeLeadError(message = ""): LeadActionState {
  if (message.includes("changed by another user")) {
    return { ok: false, message: "This lead changed since you opened it. Reload before saving." };
  }
  if (message.includes("not permitted") || message.includes("cannot reassign")) {
    return { ok: false, message: "Your role does not permit this lead change." };
  }
  if (message.includes("assignee") || message.includes("assigned member")) {
    return { ok: false, message: "Select an active member from this company." };
  }
  return initialFailure;
}

function revalidateLeadViews() {
  for (const path of ["/leads", "/dashboard", "/reports", "/team"]) {
    revalidatePath(path);
  }
}

export async function createLeadAction(
  _state: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const parsed = parseLeadForm(formData, "create");
  if (!parsed.success) {
    return { ok: false, message: "Correct the highlighted fields.", fieldErrors: parsed.fieldErrors };
  }
  let createdId: string;
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const value = parsed.data;
    const { data: id, error } = await client.rpc("create_lead", {
      target_company_id: auth.companyId,
      request_id: value.requestId,
      lead_full_name: value.fullName,
      lead_phone: value.phone,
      lead_email: value.email,
      lead_service: value.service,
      lead_location: value.location,
      lead_property_size: value.propertySize,
      lead_budget_pkr: value.budget,
      lead_expected_timeline: value.timeline,
      lead_source: value.source,
      lead_assigned_member_id: value.assignedMemberId,
      lead_score: value.score,
      lead_temperature: value.temperature,
      lead_notes: value.notes,
    });
    if (error || !id) return safeLeadError(error?.message);
    createdId = id;
  } catch (error) {
    return safeLeadError(error instanceof Error ? error.message : "");
  }
  revalidateLeadViews();
  redirect(`/leads/${createdId}`);
}

export async function updateLeadAction(
  _state: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const parsed = parseLeadForm(formData, "edit");
  if (!parsed.success) {
    return { ok: false, message: "Correct the highlighted fields.", fieldErrors: parsed.fieldErrors };
  }
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const value = parsed.data;
    const { error } = await client.rpc("update_lead", {
      target_company_id: auth.companyId,
      target_lead_id: String(formData.get("leadId") ?? ""),
      expected_updated_at: value.expectedUpdatedAt ?? "",
      lead_full_name: value.fullName,
      lead_phone: value.phone,
      lead_email: value.email,
      lead_service: value.service,
      lead_location: value.location,
      lead_property_size: value.propertySize,
      lead_budget_pkr: value.budget,
      lead_expected_timeline: value.timeline,
      lead_source: value.source,
      lead_assigned_member_id: value.assignedMemberId,
      lead_score: value.score,
      lead_temperature: value.temperature,
      lead_stage: value.stage,
      lead_notes: value.notes,
    });
    if (error) return safeLeadError(error.message);
    revalidateLeadViews();
    revalidatePath(`/leads/${formData.get("leadId")}`);
    return { ok: true, message: "Lead updated successfully." };
  } catch (error) {
    return safeLeadError(error instanceof Error ? error.message : "");
  }
}

export async function convertLeadAction(leadId: string): Promise<LeadActionState> {
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const { error } = await client.rpc("convert_lead", {
      target_company_id: auth.companyId,
      target_lead_id: leadId,
    });
    if (error) return safeLeadError(error.message);
    revalidateLeadViews();
    revalidatePath(`/leads/${leadId}`);
    return { ok: true, message: "Lead marked as converted." };
  } catch (error) {
    return safeLeadError(error instanceof Error ? error.message : "");
  }
}

export async function archiveLeadAction(
  leadId: string,
  archived: boolean,
): Promise<LeadActionState> {
  try {
    const auth = await requireLeadContext();
    const client = await createServerSupabaseClient();
    const { error } = await client.rpc("set_lead_archived", {
      target_company_id: auth.companyId,
      target_lead_id: leadId,
      archive_lead: archived,
    });
    if (error) return safeLeadError(error.message);
    revalidateLeadViews();
    return { ok: true, message: archived ? "Lead archived." : "Lead restored." };
  } catch (error) {
    return safeLeadError(error instanceof Error ? error.message : "");
  }
}
