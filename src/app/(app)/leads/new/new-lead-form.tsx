"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { createLeadAction, type LeadActionState } from "@/actions/lead-actions";
import { FormField, PageHeader } from "@/components/ui";
import type { AuthContext } from "@/lib/auth";
import type { LeadMemberOption } from "@/types/leads";

const initialState: LeadActionState = { ok: false, message: "" };

export function NewLeadForm({
  auth,
  members,
  services,
  sources,
  requestId,
}: {
  auth: AuthContext;
  members: LeadMemberOption[];
  services: string[];
  sources: string[];
  requestId: string;
}) {
  const [state, action, pending] = useActionState(createLeadAction, initialState);
  const representative = auth.role === "sales_representative";
  const defaultMember = representative ? auth.memberId : "";
  return <>
    <Link href="/leads" className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600"><ArrowLeft className="size-4" /> Back to leads</Link>
    <PageHeader title="Add new lead" description="Persist a tenant-secured opportunity in Supabase." />
    <form action={action} noValidate className="card mx-auto max-w-5xl p-5 sm:p-7">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="mb-6 border-b border-slate-100 pb-5"><h2 className="font-bold">Customer and requirement details</h2><p className="mt-1 text-sm text-slate-500">All values are validated again on the server.</p></div>
      {state.message && !state.ok && <div role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{state.message}</div>}
      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Full name" required error={state.fieldErrors?.fullName}><input name="fullName" className="input" placeholder="e.g. Hassan Rauf" /></FormField>
        <FormField label="Phone number" required error={state.fieldErrors?.phone}><input name="phone" className="input" placeholder="+92 300 1234567" /></FormField>
        <FormField label="Email address" error={state.fieldErrors?.email}><input name="email" type="email" className="input" placeholder="customer@example.com" /></FormField>
        <FormField label="Service required" required error={state.fieldErrors?.service}><select name="service" className="input" defaultValue=""><option value="">Select a service</option>{services.map(value => <option key={value}>{value}</option>)}</select></FormField>
        <FormField label="Location" required error={state.fieldErrors?.location}><input name="location" className="input" placeholder="e.g. DHA Phase 2, Islamabad" /></FormField>
        <FormField label="Property size" error={state.fieldErrors?.propertySize}><input name="propertySize" className="input" placeholder="e.g. 1 Kanal" /></FormField>
        <FormField label="Estimated budget (PKR)" required error={state.fieldErrors?.budget}><input name="budget" type="number" min="100000" step="1" className="input" placeholder="25000000" /></FormField>
        <FormField label="Expected starting timeline" error={state.fieldErrors?.timeline}><select name="timeline" className="input" defaultValue=""><option value="">Select timeline</option>{["Immediately", "Within 1 month", "Within 3 months", "Within 6 months", "Flexible"].map(value => <option key={value}>{value}</option>)}</select></FormField>
        <FormField label="Lead source" required error={state.fieldErrors?.source}><select name="source" className="input" defaultValue=""><option value="">Select source</option>{sources.map(value => <option key={value}>{value}</option>)}</select></FormField>
        <FormField label="Assigned salesperson" required error={state.fieldErrors?.assignedMemberId}><select name="assignedMemberId" className="input" defaultValue={defaultMember} disabled={representative}>{!representative && <option value="">Select team member</option>}{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select>{representative && <input type="hidden" name="assignedMemberId" value={auth.memberId} />}</FormField>
        <div className="md:col-span-2"><FormField label="Notes" error={state.fieldErrors?.notes}><textarea name="notes" rows={4} maxLength={5000} className="input resize-y" placeholder="Add useful context, preferences or next steps..." /></FormField></div>
      </div>
      <div className="mt-7 flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row"><Link href="/leads" className="btn-secondary justify-center">Cancel</Link><button disabled={pending} className="btn-primary justify-center"><Save className="size-4" />{pending ? "Saving lead…" : "Save lead"}</button></div>
    </form>
  </>;
}
