import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { MemberRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listInvitations, listMembers } from "@/data-access/repositories/membership-repository";
import { sendInvitationEmail } from "@/lib/email/invitation-email";
import { resolveTenantContext } from "@/services/tenant-service";

async function activeContext() {
  const resolution = await resolveTenantContext();
  if (resolution.state !== "active") throw new Error("Active company membership required.");
  return resolution.auth;
}

export async function getTeamAdministration() {
  const auth = await activeContext();
  const client = await createServerSupabaseClient();
  const [{ data: members, error: memberError }, { data: invitations, error: inviteError }] =
    await Promise.all([
      listMembers(client, auth.companyId),
      auth.role === "sales_representative"
        ? Promise.resolve({ data: [], error: null })
        : listInvitations(client, auth.companyId),
    ]);
  if (memberError || inviteError) throw new Error("Team data could not be loaded.");
  return { auth, members: members ?? [], invitations: invitations ?? [] };
}

function invitationSecret() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export async function inviteMember(email: string, role: MemberRole) {
  const auth = await activeContext();
  const client = await createServerSupabaseClient();
  const secret = invitationSecret();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const { data: invitationId, error } = await client.rpc("create_company_invitation", {
    target_company_id: auth.companyId,
    invited_email: email,
    invited_role: role,
    invitation_token_hash: secret.hash,
    invitation_expires_at: expiresAt,
  });
  if (error || !invitationId) throw new Error(error?.message ?? "Invitation could not be created.");
  try {
    await sendInvitationEmail({
      email: email.trim().toLowerCase(),
      companyName: auth.companyName,
      inviterName: auth.fullName,
      token: secret.token,
    });
  } catch {
    await client.rpc("revoke_company_invitation", {
      target_company_id: auth.companyId,
      target_invitation_id: invitationId,
    });
    throw new Error("Invitation email could not be delivered.");
  }
}

export async function resendInvitation(invitationId: string, email: string) {
  const auth = await activeContext();
  const client = await createServerSupabaseClient();
  const secret = invitationSecret();
  const { error } = await client.rpc("rotate_company_invitation", {
    target_company_id: auth.companyId,
    target_invitation_id: invitationId,
    invitation_token_hash: secret.hash,
    invitation_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
  await sendInvitationEmail({
    email,
    companyName: auth.companyName,
    inviterName: auth.fullName,
    token: secret.token,
  });
}

export async function revokeInvitation(invitationId: string) {
  const auth = await activeContext();
  const client = await createServerSupabaseClient();
  const { error } = await client.rpc("revoke_company_invitation", {
    target_company_id: auth.companyId,
    target_invitation_id: invitationId,
  });
  if (error) throw new Error(error.message);
}

export async function manageMember(
  memberId: string,
  action: string,
  role?: MemberRole,
) {
  const auth = await activeContext();
  const client = await createServerSupabaseClient();
  const { error } = await client.rpc("manage_company_member", {
    target_company_id: auth.companyId,
    target_member_id: memberId,
    requested_action: action,
    requested_role: role ?? undefined,
  });
  if (error) throw new Error(error.message);
}
