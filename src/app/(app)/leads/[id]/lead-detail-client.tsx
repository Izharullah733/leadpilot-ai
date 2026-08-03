"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, CalendarPlus, Check, CircleCheck, Clock3, FileText, Mail, MapPin, MapPinned, MessageCircle, Pencil, Phone, StickyNote, UserRound, Wallet } from "lucide-react";
import { AIInsightCard } from "@/components/ai-insight";
import { Dialog } from "@/components/dialog";
import { ScoreBadge, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/toast";
import { convertLeadAction, updateLeadAction, type LeadActionState } from "@/actions/lead-actions";
import { saveFollowUpAction } from "@/actions/follow-up-actions";
import { saveAppointmentAction } from "@/actions/appointment-actions";
import { formatDate, formatPKR } from "@/lib/format";
import type { AuthContext } from "@/lib/auth";
import type { LeadActivityDto, LeadDto, LeadMemberOption, LeadStage, LeadTemperature } from "@/types/leads";
import type { AILeadView } from "@/types/ai";
import { stageLabels, temperatureLabels } from "@/types/leads";

const initialState: LeadActionState = { ok: false, message: "" };

export function LeadDetailClient({
  auth,
  lead,
  members,
  activities,
  services,
  sources,
  ai,
}: {
  auth: AuthContext;
  lead: LeadDto;
  members: LeadMemberOption[];
  activities: LeadActivityDto[];
  services: string[];
  sources: string[];
  ai: AILeadView;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<"" | "followup" | "visit" | "consultation" | "edit">("");
  const [workflowError, setWorkflowError] = useState("");
  const [pending, startTransition] = useTransition();
  const [editState, editAction, editPending] = useActionState(updateLeadAction, initialState);
  const canReassign = auth.role !== "sales_representative";
  useEffect(() => {
    if (editState.ok) {
      toast(editState.message);
      setDialog("");
      router.refresh();
    }
  }, [editState, router, toast]);

  const convert = () => startTransition(async () => {
    const result = await convertLeadAction(lead.id);
    toast(result.message);
    if (result.ok) router.refresh();
  });
  const schedule = (formData: FormData) => startTransition(async () => {
    const result = dialog === "followup"
      ? await saveFollowUpAction(formData)
      : await saveAppointmentAction(formData);
    if (!result.ok) return setWorkflowError(result.message);
    toast(result.message);
    setWorkflowError("");
    setDialog("");
    router.refresh();
  });

  return <>
    <Link href="/leads" className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600"><ArrowLeft className="size-4" /> Back to leads</Link>
    <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
      <div className="flex items-start gap-4"><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-blue-100 text-lg font-extrabold text-blue-700">{lead.fullName.split(/\s+/).slice(0, 2).map(value => value[0]).join("")}</span><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold">{lead.fullName}</h1><StatusBadge status={temperatureLabels[lead.temperature]} /><ScoreBadge score={lead.score} /></div><p className="mt-1 text-sm text-slate-500">{lead.leadNumber} · Created {formatDate(lead.createdAt)}</p></div></div>
      <div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => setDialog("edit")}><Pencil className="size-4" /> Edit</button><button className="btn-secondary" onClick={() => setDialog("followup")}><CalendarPlus className="size-4" /> Follow-up</button><button className="btn-secondary" onClick={() => setDialog("visit")}><MapPinned className="size-4" /> Site visit</button><button className="btn-secondary" onClick={() => setDialog("consultation")}><Calendar className="size-4" /> Consultation</button><button disabled={pending || lead.stage === "converted"} className="btn-primary bg-emerald-600" onClick={convert}><CircleCheck className="size-4" /> {lead.stage === "converted" ? "Converted" : pending ? "Converting…" : "Mark converted"}</button></div>
    </div>
    <div className="grid gap-6 xl:grid-cols-3"><div className="space-y-6 xl:col-span-2">
      <section className="card p-5"><h2 className="font-bold">Contact information</h2><div className="mt-5 grid gap-4 sm:grid-cols-3"><Info icon={<Phone />} label="Phone" value={lead.phone} /><Info icon={<Mail />} label="Email" value={lead.email || "Not provided"} /><Info icon={<MapPin />} label="Location" value={lead.location} /></div></section>
      <section className="card p-5"><h2 className="font-bold">Requirement summary</h2><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Info icon={<FileText />} label="Service" value={lead.service} /><Info icon={<MapPinned />} label="Property size" value={lead.propertySize || "Not provided"} /><Info icon={<Wallet />} label="Estimated budget" value={formatPKR(lead.budget)} /><Info icon={<Clock3 />} label="Timeline" value={lead.timeline || "Not provided"} /><Info icon={<UserRound />} label="Assigned to" value={lead.salesperson} /><Info icon={<MessageCircle />} label="Lead source" value={lead.source} /><Info icon={<Check />} label="Pipeline stage" value={stageLabels[lead.stage]} /><Info icon={<Calendar />} label="Last updated" value={formatDate(lead.updatedAt)} /></div></section>
      <section className="card p-5"><h2 className="font-bold">Notes</h2><div className="mt-4 flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950"><StickyNote className="size-5 shrink-0 text-amber-600" />{lead.notes || "No notes have been added yet."}</div></section>
      <section className="card p-5"><h2 className="font-bold">Activity timeline</h2><div className="mt-5">{activities.length ? activities.map((activity, index) => <div key={activity.id} className="relative flex gap-4 pb-6 last:pb-0"><div className="relative z-10 mt-1 size-3 shrink-0 rounded-full bg-blue-600 ring-4 ring-blue-50" />{index < activities.length - 1 && <div className="absolute bottom-0 left-[5px] top-3 w-px bg-slate-200" />}<div><b className="text-sm">{activity.description}</b><p className="text-xs text-slate-500">{activity.actorName}</p><small className="mt-1 block text-slate-400">{formatDate(activity.occurredAt)}</small></div></div>) : <p className="text-sm text-slate-500">No activity recorded.</p>}</div></section>
    </div><AIInsightCard lead={lead} initial={ai} /></div>
    <Dialog open={!!dialog} title={dialog === "edit" ? "Edit lead" : dialog === "visit" ? "Schedule site visit" : dialog === "consultation" ? "Schedule consultation" : "Schedule follow-up"} onClose={() => { setDialog(""); setWorkflowError(""); }}>
      {dialog === "edit" ? <form action={editAction} className="space-y-3">
        <input type="hidden" name="leadId" value={lead.id} /><input type="hidden" name="expectedUpdatedAt" value={lead.updatedAt} />
        {editState.message && !editState.ok && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{editState.message}</div>}
        <label className="block"><span className="label">Full name</span><input name="fullName" className="input" defaultValue={lead.fullName} /></label>
        <div className="grid grid-cols-2 gap-3"><label><span className="label">Phone</span><input name="phone" className="input" defaultValue={lead.phone} /></label><label><span className="label">Email</span><input name="email" className="input" defaultValue={lead.email} /></label></div>
        <label className="block"><span className="label">Service</span><select name="service" className="input" defaultValue={lead.service}>{[...new Set([lead.service, ...services])].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="block"><span className="label">Location</span><input name="location" className="input" defaultValue={lead.location} /></label>
        <div className="grid grid-cols-2 gap-3"><label><span className="label">Property size</span><input name="propertySize" className="input" defaultValue={lead.propertySize} /></label><label><span className="label">Budget</span><input name="budget" type="number" className="input" defaultValue={lead.budget} /></label></div>
        <div className="grid grid-cols-2 gap-3"><label><span className="label">Timeline</span><input name="timeline" className="input" defaultValue={lead.timeline} /></label><label><span className="label">Source</span><select name="source" className="input" defaultValue={lead.source}>{[...new Set([lead.source, ...sources])].map(value => <option key={value}>{value}</option>)}</select></label></div>
        <div className="grid grid-cols-2 gap-3"><label><span className="label">Score</span><input name="score" type="number" min="0" max="100" className="input" defaultValue={lead.score} /></label><label><span className="label">Temperature</span><select name="temperature" className="input" defaultValue={lead.temperature}>{(["hot", "warm", "cold"] as LeadTemperature[]).map(value => <option key={value} value={value}>{temperatureLabels[value]}</option>)}</select></label></div>
        <label className="block"><span className="label">Stage</span><select name="stage" className="input" defaultValue={lead.stage}>{(Object.keys(stageLabels) as LeadStage[]).filter(value => value !== "converted" || lead.stage === "converted").map(value => <option key={value} value={value}>{stageLabels[value]}</option>)}</select></label>
        <label className="block"><span className="label">Assigned member</span><select name="assignedMemberId" className="input" defaultValue={lead.assignedMemberId} disabled={!canReassign}>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select>{!canReassign && <input type="hidden" name="assignedMemberId" value={lead.assignedMemberId} />}</label>
        <label className="block"><span className="label">Notes</span><textarea name="notes" className="input" rows={4} defaultValue={lead.notes} /></label>
        <button disabled={editPending} className="btn-primary w-full justify-center">{editPending ? "Saving…" : "Save changes"}</button>
      </form> : <form action={schedule} className="space-y-4">
        {workflowError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{workflowError}</p>}
        <input type="hidden" name="leadId" value={lead.id} />
        <input type="hidden" name="assignedMemberId" value={lead.assignedMemberId || auth.memberId} />
        {dialog !== "followup" && <><input type="hidden" name="customerName" value={lead.fullName} /><input type="hidden" name="type" value={dialog === "visit" ? "site_visit" : "consultation"} /></>}
        <label className="block"><span className="label">Date and time</span><input name={dialog === "followup" ? "dueAt" : "startsAt"} type="datetime-local" className="input" required /></label>
        {dialog === "followup" ? <>
          <label className="block"><span className="label">Priority</span><select name="priority" className="input" defaultValue="normal"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></label>
          <label className="block"><span className="label">Notes</span><textarea name="notes" className="input" rows={3} /></label>
        </> : <>
          <input type="hidden" name="endsAt" value="" />
          <label className="block"><span className="label">Location</span><input name="location" className="input" defaultValue={dialog === "visit" ? lead.location : ""} /></label>
          <label className="block"><span className="label">Notes</span><textarea name="notes" className="input" rows={3} /></label>
        </>}
        <button disabled={pending} className="btn-primary w-full justify-center">{pending ? "Scheduling…" : "Confirm schedule"}</button>
      </form>}
    </Dialog>
  </>;
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex gap-3"><span className="mt-0.5 text-slate-400 [&>svg]:size-4">{icon}</span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div></div>;
}
