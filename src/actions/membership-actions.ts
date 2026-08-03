"use server";

import { revalidatePath } from "next/cache";
import type { MemberRole } from "@/lib/auth";
import {
  inviteMember,
  manageMember,
  resendInvitation,
  revokeInvitation,
} from "@/services/membership-service";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("already an active") || message.includes("duplicate")) return "This person is already a member or has a pending invitation.";
  if (message.includes("not permitted") || message.includes("cannot manage")) return "Your role does not permit this action.";
  if (message.includes("final active owner")) return "The final active owner cannot be removed, suspended, or demoted.";
  if (message.includes("email")) return message;
  return "The requested team change could not be completed.";
}

export async function createInvitationAction(input: {
  email: string;
  role: MemberRole;
}): Promise<ActionResult> {
  try {
    await inviteMember(input.email, input.role);
    revalidatePath("/team");
    return { ok: true, message: "Invitation sent." };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}

export async function resendInvitationAction(id: string, email: string): Promise<ActionResult> {
  try {
    await resendInvitation(id, email);
    revalidatePath("/team");
    return { ok: true, message: "A fresh invitation link was sent." };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}

export async function revokeInvitationAction(id: string): Promise<ActionResult> {
  try {
    await revokeInvitation(id);
    revalidatePath("/team");
    return { ok: true, message: "Invitation revoked." };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}

export async function manageMemberAction(input: {
  memberId: string;
  action: "change_role" | "suspend" | "reactivate" | "remove";
  role?: MemberRole;
}): Promise<ActionResult> {
  try {
    await manageMember(input.memberId, input.action, input.role);
    revalidatePath("/team");
    return { ok: true, message: "Team membership updated." };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}
