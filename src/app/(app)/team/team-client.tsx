"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Mail, Target, UserPlus, Users, Wallet } from "lucide-react";
import type { Database } from "@/types/database";
import type { AuthContext, MemberRole } from "@/lib/auth";
import { roleLabels } from "@/lib/auth";
import { Dialog } from "@/components/dialog";
import { PageHeader, ProgressBar } from "@/components/ui";
import { useToast } from "@/components/toast";
import { formatPKR } from "@/lib/format";
import type { LeadMetrics } from "@/types/leads";
import {
  createInvitationAction,
  manageMemberAction,
  resendInvitationAction,
  revokeInvitationAction,
  type ActionResult,
} from "@/actions/membership-actions";

type Member = Database["public"]["Functions"]["list_company_members"]["Returns"][number];
type Invitation = Database["public"]["Functions"]["list_company_invitations"]["Returns"][number];

export function TeamClient({
  auth,
  members,
  invitations,
  leadPerformance,
  leadMetrics,
  workflowMetrics,
}: {
  auth: AuthContext;
  members: Member[];
  invitations: Invitation[];
  leadPerformance: { memberId: string; assigned: number; conversions: number; pipeline: number; averageScore: number }[];
  leadMetrics: LeadMetrics;
  workflowMetrics: { memberId: string; followUpsToday: number; overdueFollowUps: number }[];
}) {
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const canInvite = auth.role === "owner" || auth.role === "admin";
  const canSeeAll = auth.role !== "sales_representative";
  const metrics = new Map(leadPerformance.map(item => [item.memberId, {
    assigned: item.assigned,
    conversions: item.conversions,
    pipeline: item.pipeline,
    average: item.averageScore,
  }]));
  const followUpMetrics = new Map(workflowMetrics.map(item => [item.memberId, item]));

  const run = (operation: () => Promise<ActionResult>) => startTransition(async () => {
    const result = await operation();
    toast(result.message);
  });

  return <>
    <PageHeader
      title="Company team"
      description={`Real Supabase memberships for ${auth.companyName}.`}
      action={canInvite ? <button className="btn-primary" onClick={() => setInviteOpen(true)}><UserPlus className="size-4" /> Invite member</button> : undefined}
    />
    <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
      Identities, roles, lead performance, and follow-up workload are tenant-secured Supabase data.
    </div>
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {members.map(member => {
        const metric = metrics.get(member.member_id) ?? { assigned: 0, conversions: 0, pipeline: 0, average: 0 };
        const workflow = followUpMetrics.get(member.member_id) ?? { followUpsToday: 0, overdueFollowUps: 0 };
        const canManage = member.member_id !== auth.memberId && (
          auth.role === "owner" ||
          (auth.role === "admin" && !["owner", "admin"].includes(member.role))
        );
        return <article key={member.member_id} className="card overflow-hidden">
          <div className={`h-2 ${member.membership_status === "active" ? "bg-blue-600" : "bg-slate-400"}`} />
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-blue-100 font-extrabold text-blue-700">{initials(member.full_name)}</span>
              <span className={`rounded-full px-2 py-1 text-xs font-bold ${member.membership_status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{member.membership_status}</span>
            </div>
            <h2 className="mt-4 text-lg font-bold">{member.full_name}</h2>
            <p className="text-sm text-slate-500">{roleLabels[member.role]}</p>
            <a href={`mailto:${member.email}`} className="mt-2 flex items-center gap-2 break-all text-xs text-slate-500 hover:text-blue-600"><Mail className="size-3.5 shrink-0" />{member.email}</a>
            <p className="mt-2 text-xs text-slate-400">Joined {member.joined_at ? new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(member.joined_at)) : "not yet"}</p>
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-3">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Live lead metrics · Supabase</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <Metric value={metric.assigned} label="Assigned" />
                <Metric value={metric.conversions} label="Won" />
                <Metric value={workflow.followUpsToday} label="Due today" />
                <Metric value={workflow.overdueFollowUps} label="Overdue" />
              </div>
              <p className="mt-3 text-xs text-slate-500">Active pipeline <b className="float-right text-slate-800">{formatPKR(metric.pipeline)}</b></p>
              <div className="mt-3 flex justify-between text-xs"><span>Average score</span><b>{metric.average}</b></div>
              <ProgressBar value={metric.average} />
            </div>
            {canManage && <div className="mt-4 grid grid-cols-2 gap-2">
              <select aria-label={`Role for ${member.full_name}`} defaultValue={member.role} disabled={pending || member.membership_status !== "active"} onChange={event => run(() => manageMemberAction({ memberId: member.member_id, action: "change_role", role: event.target.value as MemberRole }))} className="input py-2 text-xs">
                {(auth.role === "owner" ? ["owner", "admin", "sales_manager", "sales_representative"] : ["sales_manager", "sales_representative"]).map(role => <option key={role} value={role}>{roleLabels[role as MemberRole]}</option>)}
              </select>
              <button disabled={pending} className="btn-secondary justify-center text-xs" onClick={() => run(() => manageMemberAction({ memberId: member.member_id, action: member.membership_status === "suspended" ? "reactivate" : "suspend" }))}>{member.membership_status === "suspended" ? "Reactivate" : "Suspend"}</button>
              <button disabled={pending} className="btn-secondary col-span-2 justify-center text-xs text-rose-700" onClick={() => run(() => manageMemberAction({ memberId: member.member_id, action: "remove" }))}>Remove member</button>
            </div>}
          </div>
        </article>;
      })}
    </div>
    {canSeeAll && <section className="card mt-6 overflow-hidden">
      <div className="border-b border-slate-200 p-5"><h2 className="font-bold">Invitations</h2><p className="text-sm text-slate-500">Pending, accepted, expired, and revoked invitation history.</p></div>
      <div className="divide-y divide-slate-100">
        {!invitations.length && <p className="p-5 text-sm text-slate-500">No invitations yet.</p>}
        {invitations.map(invitation => <div key={invitation.invitation_id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1"><b className="block break-all text-sm">{invitation.email}</b><span className="text-xs text-slate-500">{roleLabels[invitation.role]} · {invitation.invitation_status} · expires {new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(invitation.expires_at))}</span></div>
          {canInvite && invitation.invitation_status === "pending" && <div className="flex gap-2">
            <button disabled={pending} className="btn-secondary text-xs" onClick={() => run(() => resendInvitationAction(invitation.invitation_id, invitation.email))}>Resend</button>
            <button disabled={pending} className="btn-secondary text-xs text-rose-700" onClick={() => run(() => revokeInvitationAction(invitation.invitation_id))}>Revoke</button>
          </div>}
        </div>)}
      </div>
    </section>}
    {canSeeAll && <section className="card mt-6 p-5"><div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
      <Snapshot icon={<Users />} value={members.length} label="Visible members" />
      <Snapshot icon={<CheckCircle2 />} value={leadMetrics.converted} label="Converted leads" />
      <Snapshot icon={<Wallet />} value={formatPKR(leadMetrics.activePipeline)} label="Active pipeline" />
      <Snapshot icon={<Target />} value={leadMetrics.total} label="Accessible leads" />
    </div></section>}
    <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} auth={auth} pending={pending} run={run} />
  </>;
}

function InviteDialog({ open, onClose, auth, pending, run }: { open: boolean; onClose: () => void; auth: AuthContext; pending: boolean; run: (operation: () => Promise<ActionResult>) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("sales_representative");
  return <Dialog open={open} title="Invite team member" onClose={onClose}><form onSubmit={event => {
    event.preventDefault();
    run(async () => {
      const result = await createInvitationAction({ email, role });
      if (result.ok) { setEmail(""); onClose(); }
      return result;
    });
  }} className="space-y-4">
    <label className="block"><span className="label">Business email</span><input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="input" /></label>
    <label className="block"><span className="label">Role</span><select value={role} onChange={event => setRole(event.target.value as MemberRole)} className="input">
      {(auth.role === "owner" ? ["admin", "sales_manager", "sales_representative"] : ["sales_manager", "sales_representative"]).map(item => <option key={item} value={item}>{roleLabels[item as MemberRole]}</option>)}
    </select></label>
    <p className="text-xs text-slate-500">A single-use link valid for 72 hours will be delivered by the configured mail service.</p>
    <button disabled={pending} className="btn-primary w-full justify-center">{pending ? "Sending…" : "Send invitation"}</button>
  </form></Dialog>;
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(); }
function Metric({ value, label }: { value: number; label: string }) { return <div className="rounded-lg bg-slate-50 p-2"><b className="block">{value}</b><small className="text-[10px] text-slate-500">{label}</small></div>; }
function Snapshot({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) { return <div className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-blue-600 [&>svg]:size-5">{icon}</span><span className="min-w-0"><b className="block break-words text-sm">{value}</b><small className="text-slate-500">{label}</small></span></div>; }
