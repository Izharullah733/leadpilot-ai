"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarCheck2, CalendarDays, Check, ClockAlert, Pencil, Plus, X } from "lucide-react";
import { saveFollowUpAction, transitionFollowUpAction } from "@/actions/follow-up-actions";
import { Dialog } from "@/components/dialog";
import { useToast } from "@/components/toast";
import { PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { AuthContext } from "@/lib/auth";
import type { FollowUpDto, WorkflowLeadOption, WorkflowMemberOption } from "@/types/workflows";
import { priorityLabels } from "@/types/workflows";

type Groups = {
  overdue: FollowUpDto[];
  today: FollowUpDto[];
  upcoming: FollowUpDto[];
  completed: FollowUpDto[];
};

const localInput = (iso: string) => {
  const date = new Date(iso);
  const shifted = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
};

export function FollowUpsClient({
  auth,
  members,
  leads,
  groups,
  timeZone,
}: {
  auth: AuthContext;
  members: WorkflowMemberOption[];
  leads: WorkflowLeadOption[];
  groups: Groups;
  timeZone: string;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<FollowUpDto | null | undefined>(undefined);
  const [requestId, setRequestId] = useState("");
  const [error, setError] = useState("");
  const elevated = auth.role !== "sales_representative";
  const runTransition = (item: FollowUpDto, status: "completed" | "cancelled") =>
    startTransition(async () => {
      const result = await transitionFollowUpAction(item.id, status);
      toast(result.message);
    });
  const submit = (formData: FormData) => startTransition(async () => {
    const result = await saveFollowUpAction(formData);
    if (!result.ok) return setError(result.message);
    toast(result.message);
    setError("");
    setEditing(undefined);
  });
  const cards = [
    { key: "overdue", title: "Overdue", icon: ClockAlert, tone: "bg-rose-50 text-rose-600", items: groups.overdue },
    { key: "today", title: "Due today", icon: CalendarCheck2, tone: "bg-amber-50 text-amber-600", items: groups.today },
    { key: "upcoming", title: "Upcoming", icon: CalendarDays, tone: "bg-blue-50 text-blue-600", items: groups.upcoming },
    { key: "completed", title: "Completed", icon: Check, tone: "bg-emerald-50 text-emerald-600", items: groups.completed.slice(0, 20) },
  ];
  return <>
    <PageHeader
      title="Follow-ups"
      description={`Live, role-scoped follow-ups · ${timeZone}`}
      action={<button className="btn-primary" onClick={() => { setRequestId(crypto.randomUUID()); setEditing(null); }}><Plus className="size-4" /> New follow-up</button>}
    />
    <div className="grid gap-5 xl:grid-cols-2">
      {cards.map(group => <section key={group.key} className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5">
          <span className={`rounded-lg p-2 ${group.tone}`}><group.icon className="size-5" /></span>
          <div><h2 className="font-bold">{group.title}</h2><p className="text-xs text-slate-500">{group.items.length} records</p></div>
        </div>
        <div className="divide-y divide-slate-100">
          {!group.items.length && <p className="p-8 text-center text-sm text-slate-500">Nothing in this group.</p>}
          {group.items.map(item => <article key={item.id} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Link href={`/leads/${item.leadId}`} className="font-bold hover:text-blue-600">{item.leadName}</Link>
                <p className="text-xs text-slate-500">{item.leadNumber} · {item.assignedMemberName}</p>
                <p className="mt-2 text-sm">{formatDate(item.dueAt, true)}</p>
                {item.notes && <p className="mt-1 break-words text-xs text-slate-500">{item.notes}</p>}
              </div>
              <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${item.priority === "urgent" || item.priority === "high" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700"}`}>{priorityLabels[item.priority]}</span>
            </div>
            {item.status === "pending" && <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={pending} className="btn-secondary text-xs" onClick={() => setEditing(item)}><Pencil className="size-3.5" /> Reschedule</button>
              <button disabled={pending} className="btn-secondary text-xs text-emerald-700" onClick={() => runTransition(item, "completed")}><Check className="size-3.5" /> Complete</button>
              {(elevated || item.assignedMemberId === auth.memberId) && <button disabled={pending} className="btn-secondary text-xs text-rose-700" onClick={() => runTransition(item, "cancelled")}><X className="size-3.5" /> Cancel</button>}
            </div>}
          </article>)}
        </div>
      </section>)}
    </div>
    <Dialog open={editing !== undefined} title={editing ? "Reschedule follow-up" : "New follow-up"} onClose={() => { setEditing(undefined); setError(""); }}>
      <form action={submit} className="space-y-4">
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <input type="hidden" name="requestId" value={requestId} />
        {editing && <><input type="hidden" name="id" value={editing.id} /><input type="hidden" name="expectedUpdatedAt" value={editing.updatedAt} /></>}
        <label className="block"><span className="label">Lead</span><select name="leadId" className="input" defaultValue={editing?.leadId ?? ""} disabled={!!editing} required><option value="">Select lead</option>{leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name} · {lead.leadNumber}</option>)}</select>{editing && <input type="hidden" name="leadId" value={editing.leadId} />}</label>
        <label className="block"><span className="label">Assigned member</span><select name="assignedMemberId" className="input" defaultValue={editing?.assignedMemberId ?? (auth.role === "sales_representative" ? auth.memberId : "")} disabled={!elevated} required><option value="">Select member</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select>{!elevated && <input type="hidden" name="assignedMemberId" value={auth.memberId} />}</label>
        <label className="block"><span className="label">Due date and time</span><input name="dueAt" type="datetime-local" className="input" defaultValue={editing ? localInput(editing.dueAt) : ""} required /></label>
        <label className="block"><span className="label">Priority</span><select name="priority" className="input" defaultValue={editing?.priority ?? "normal"}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block"><span className="label">Notes</span><textarea name="notes" className="input" rows={3} defaultValue={editing?.notes ?? ""} /></label>
        <button disabled={pending} className="btn-primary w-full justify-center">{pending ? "Saving…" : editing ? "Save schedule" : "Create follow-up"}</button>
      </form>
    </Dialog>
  </>;
}
