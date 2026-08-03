"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Building, CalendarDays, Check, Clock3, MapPin, Pencil, Plus, UserRound, X } from "lucide-react";
import { saveAppointmentAction, transitionAppointmentAction } from "@/actions/appointment-actions";
import { Dialog } from "@/components/dialog";
import { useToast } from "@/components/toast";
import { PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { AuthContext } from "@/lib/auth";
import type { AppointmentDto, AppointmentStatus, AppointmentType, WorkflowLeadOption, WorkflowMemberOption } from "@/types/workflows";
import { appointmentStatusLabels, appointmentTypeLabels } from "@/types/workflows";

const localInput = (iso: string) => new Date(new Date(iso).getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 16);

export function AppointmentsClient({ auth, appointments, members, leads, timeZone }: {
  auth: AuthContext;
  appointments: AppointmentDto[];
  members: WorkflowMemberOption[];
  leads: WorkflowLeadOption[];
  timeZone: string;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<"all" | AppointmentType>("all");
  const [status, setStatus] = useState<"all" | AppointmentStatus>("all");
  const [editing, setEditing] = useState<AppointmentDto | null | undefined>(undefined);
  const [requestId, setRequestId] = useState("");
  const [error, setError] = useState("");
  const elevated = auth.role !== "sales_representative";
  const shown = useMemo(() => appointments.filter(item =>
    (type === "all" || item.type === type) && (status === "all" || item.status === status)
  ), [appointments, status, type]);
  const submit = (formData: FormData) => startTransition(async () => {
    const result = await saveAppointmentAction(formData);
    if (!result.ok) return setError(result.message);
    toast(result.message); setError(""); setEditing(undefined);
  });
  const transition = (item: AppointmentDto, next: AppointmentStatus) => startTransition(async () => {
    const result = await transitionAppointmentAction(item.id, next);
    toast(result.message);
  });
  return <>
    <PageHeader title="Appointments" description={`Live appointments · ${timeZone}`} action={<button className="btn-primary" onClick={() => { setRequestId(crypto.randomUUID()); setEditing(null); }}><Plus className="size-4" /> New appointment</button>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:w-fit lg:grid-cols-[220px_220px]">
      <label><span className="sr-only">Appointment type</span><select className="input" value={type} onChange={event => setType(event.target.value as typeof type)}><option value="all">All types</option>{Object.entries(appointmentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span className="sr-only">Appointment status</span><select className="input" value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="all">All statuses</option>{Object.entries(appointmentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {!shown.length && <div className="card p-10 text-center text-sm text-slate-500">No appointments match these filters.</div>}
    <div className="grid gap-4 lg:grid-cols-2">
      {shown.map(item => <article key={item.id} className="card p-5">
        <div className="flex items-start justify-between gap-3"><span className={`rounded-xl p-3 ${item.type === "site_visit" ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600"}`}>{item.type === "site_visit" ? <Building /> : <CalendarDays />}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{appointmentStatusLabels[item.status]}</span></div>
        <h2 className="mt-4 text-lg font-bold">{item.leadId ? <Link href={`/leads/${item.leadId}`} className="hover:text-blue-600">{item.customerName}</Link> : item.customerName}</h2>
        <p className="text-sm font-semibold text-blue-600">{appointmentTypeLabels[item.type]}{item.leadNumber ? ` · ${item.leadNumber}` : ""}</p>
        <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2"><p className="flex items-center gap-2"><Clock3 className="size-4 text-slate-400" />{formatDate(item.startsAt, true)}</p><p className="flex items-center gap-2"><MapPin className="size-4 text-slate-400" />{item.location || "Not specified"}</p><p className="flex items-center gap-2"><UserRound className="size-4 text-slate-400" />{item.assignedMemberName}</p></div>
        {!["completed", "cancelled"].includes(item.status) && <div className="mt-5 flex flex-wrap gap-2">
          <button disabled={pending} className="btn-secondary text-xs" onClick={() => setEditing(item)}><Pencil className="size-3.5" /> Reschedule</button>
          {item.status === "pending" && <button disabled={pending} className="btn-secondary text-xs text-blue-700" onClick={() => transition(item, "confirmed")}><Check className="size-3.5" /> Confirm</button>}
          {item.status === "confirmed" && <button disabled={pending} className="btn-secondary text-xs text-emerald-700" onClick={() => transition(item, "completed")}><Check className="size-3.5" /> Complete</button>}
          <button disabled={pending} className="btn-secondary text-xs text-rose-700" onClick={() => transition(item, "cancelled")}><X className="size-3.5" /> Cancel</button>
          <button disabled title="Coming in integration stage" className="btn-secondary text-xs">Reminder · coming later</button>
        </div>}
      </article>)}
    </div>
    <Dialog open={editing !== undefined} title={editing ? "Edit appointment" : "New appointment"} onClose={() => { setEditing(undefined); setError(""); }}>
      <form action={submit} className="space-y-4">
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <input type="hidden" name="requestId" value={requestId} />
        {editing && <><input type="hidden" name="id" value={editing.id} /><input type="hidden" name="expectedUpdatedAt" value={editing.updatedAt} /></>}
        <label className="block"><span className="label">Linked lead</span><select name="leadId" className="input" defaultValue={editing?.leadId ?? (elevated ? "" : leads[0]?.id)} disabled={!!editing} required={!elevated}><option value="">{elevated ? "No linked lead" : "Select assigned lead"}</option>{leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name} · {lead.leadNumber}</option>)}</select>{editing && <input type="hidden" name="leadId" value={editing.leadId ?? ""} />}</label>
        <label className="block"><span className="label">Customer name</span><input name="customerName" className="input" defaultValue={editing?.customerName ?? ""} /></label>
        <label className="block"><span className="label">Type</span><select name="type" className="input" defaultValue={editing?.type ?? "site_visit"}>{Object.entries(appointmentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="grid gap-3 sm:grid-cols-2"><label><span className="label">Starts</span><input name="startsAt" type="datetime-local" className="input" defaultValue={editing ? localInput(editing.startsAt) : ""} required /></label><label><span className="label">Ends (optional)</span><input name="endsAt" type="datetime-local" className="input" defaultValue={editing?.endsAt ? localInput(editing.endsAt) : ""} /></label></div>
        <label className="block"><span className="label">Location</span><input name="location" className="input" defaultValue={editing?.location ?? ""} /></label>
        <label className="block"><span className="label">Assigned member</span><select name="assignedMemberId" className="input" defaultValue={editing?.assignedMemberId ?? (auth.role === "sales_representative" ? auth.memberId : "")} disabled={!elevated} required><option value="">Select member</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select>{!elevated && <input type="hidden" name="assignedMemberId" value={auth.memberId} />}</label>
        <label className="block"><span className="label">Notes</span><textarea name="notes" className="input" rows={3} defaultValue={editing?.notes ?? ""} /></label>
        <button disabled={pending} className="btn-primary w-full justify-center">{pending ? "Saving…" : editing ? "Save appointment" : "Create appointment"}</button>
      </form>
    </Dialog>
  </>;
}
