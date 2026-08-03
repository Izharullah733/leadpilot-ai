"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Bot, Building2, Check, PlugZap, Plus, Save, SlidersHorizontal, UserRound, Wrench, X } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/toast";
import { updateCompanySettingsAction } from "@/actions/settings-actions";
import { updateProfileAction } from "@/actions/profile-actions";
import { updateNotificationPreferencesAction } from "@/actions/notification-actions";
import { updateCompanyAISettingsAction } from "@/actions/ai-actions";
import { formatPKR } from "@/lib/format";
import {
  notificationCategories, supportedTimezones,
  type CompanySettingsDto, type NotificationCategory,
  type NotificationPreferences, type ScoringRules, type SettingsPageData,
} from "@/types/settings";
import { aiAllowedRoles } from "@/types/ai";
import { roleLabels } from "@/lib/auth";

const sections = [
  { id: "company", label: "Company profile", icon: Building2 },
  { id: "catalogs", label: "Services & sources", icon: Wrench },
  { id: "scoring", label: "Lead scoring", icon: SlidersHorizontal },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "ai", label: "AI assistance", icon: Bot },
  { id: "profile", label: "My profile", icon: UserRound },
  { id: "integrations", label: "Integrations", icon: PlugZap },
] as const;

const categoryLabels: Record<NotificationCategory, string> = {
  new_lead_assigned: "New lead assigned", lead_reassigned: "Lead reassigned",
  follow_up_due: "Follow-up due", follow_up_overdue: "Follow-up overdue",
  appointment_created: "Appointment created", appointment_rescheduled: "Appointment rescheduled",
  appointment_cancelled: "Appointment cancelled", lead_converted: "Lead converted",
  membership_event: "Membership and role security events",
};

export function SettingsClient({ data }: { data: SettingsPageData }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<(typeof sections)[number]["id"]>("company");
  const [company, setCompany] = useState(data.company);
  const [profile, setProfile] = useState(data.profile);
  const [preferences, setPreferences] = useState<NotificationPreferences>(data.preferences);
  const [error, setError] = useState("");
  const canEditCompany = data.auth.role === "owner" || data.auth.role === "admin";

  const saveCompany = () => startTransition(async () => {
    const form = new FormData();
    Object.entries({
      name: company.name, businessEmail: company.businessEmail, phone: company.phone,
      city: company.city, address: company.address, timezone: company.timezone,
      companyUpdatedAt: company.companyUpdatedAt, settingsUpdatedAt: company.settingsUpdatedAt,
      services: JSON.stringify(company.services), disabledServices: JSON.stringify(company.disabledServices),
      leadSources: JSON.stringify(company.leadSources), disabledLeadSources: JSON.stringify(company.disabledLeadSources),
      scoringRules: JSON.stringify(company.scoringRules), notificationDefaults: JSON.stringify(company.notificationDefaults),
    }).forEach(([key, value]) => form.set(key, value));
    const result = await updateCompanySettingsAction(form);
    setError(result.ok ? "" : [result.message, ...Object.values(result.fieldErrors ?? {})].join(" ")); toast(result.message);
    if (result.ok) router.refresh();
  });
  const saveProfile = () => startTransition(async () => {
    const form = new FormData();
    form.set("fullName", profile.fullName); form.set("profilePhone", profile.phone);
    form.set("profileTimezone", profile.timezone); form.set("profileUpdatedAt", profile.updatedAt);
    const result = await updateProfileAction(form);
    setError(result.ok ? "" : [result.message, ...Object.values(result.fieldErrors ?? {})].join(" ")); toast(result.message);
    if (result.ok) router.refresh();
  });
  const savePreferences = () => startTransition(async () => {
    const form = new FormData(); form.set("preferences", JSON.stringify(preferences));
    const result = await updateNotificationPreferencesAction(form);
    setError(result.ok ? "" : result.message); toast(result.message);
    if (result.ok) router.refresh();
  });
  const saveAI = () => startTransition(async () => {
    const form = new FormData(); form.set("aiSettings", JSON.stringify(company.aiSettings));
    form.set("settingsUpdatedAt", company.settingsUpdatedAt);
    const result = await updateCompanyAISettingsAction(form);
    setError(result.ok ? "" : result.message); toast(result.message); if (result.ok) router.refresh();
  });

  return <>
    <PageHeader title="Settings" description={`Database-backed configuration for ${data.auth.companyName}.`} />
    <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
      <nav className="card h-fit p-2" aria-label="Settings sections">
        {sections.map(section => <button key={section.id} onClick={() => { setActive(section.id); setError(""); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold ${active === section.id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}><section.icon className="size-4" />{section.label}</button>)}
      </nav>
      <section className="card min-w-0 p-5 sm:p-7">
        {error && <p role="alert" className="mb-5 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
        {!canEditCompany && !["profile", "notifications", "integrations"].includes(active) && <p className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Your role has read-only access to company configuration.</p>}
        {active === "company" && <CompanyProfile company={company} setCompany={setCompany} disabled={!canEditCompany} />}
        {active === "catalogs" && <CatalogSettings company={company} setCompany={setCompany} disabled={!canEditCompany} />}
        {active === "scoring" && <ScoringSettings rules={company.scoringRules} setRules={rules => setCompany(current => ({ ...current, scoringRules: rules }))} disabled={!canEditCompany} />}
        {active === "notifications" && <NotificationSettings company={company} setCompany={setCompany} preferences={preferences} setPreferences={setPreferences} canEditCompany={canEditCompany} />}
        {active === "ai" && <AISettings company={company} setCompany={setCompany} disabled={!canEditCompany} />}
        {active === "profile" && <ProfileSettings profile={profile} setProfile={setProfile} />}
        {active === "integrations" && <Integrations />}
        {active === "profile" ? <SaveBar pending={pending} onSave={saveProfile} label="Save profile" />
          : active === "ai" && canEditCompany ? <SaveBar pending={pending} onSave={saveAI} label="Save AI settings" />
          : active === "notifications" ? <div className="mt-7 flex flex-wrap gap-3 border-t border-slate-100 pt-5"><button disabled={pending} className="btn-primary" onClick={savePreferences}><Save className="size-4" /> Save my preferences</button>{canEditCompany && <button disabled={pending} className="btn-secondary" onClick={saveCompany}>Save company defaults</button>}</div>
            : active !== "integrations" && canEditCompany ? <SaveBar pending={pending} onSave={saveCompany} label="Save changes" /> : null}
      </section>
    </div>
  </>;
}

function Heading({ title, description }: { title: string; description: string }) { return <div className="mb-6"><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>; }
function Field({ label, value, onChange, disabled, type = "text" }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string }) { return <label className="block"><span className="label">{label}</span><input aria-label={label} type={type} className="input disabled:bg-slate-100" value={value} onChange={event => onChange(event.target.value)} disabled={disabled} /></label>; }
function SaveBar({ pending, onSave, label }: { pending: boolean; onSave: () => void; label: string }) { return <div className="mt-7 border-t border-slate-100 pt-5"><button disabled={pending} className="btn-primary" onClick={onSave}><Save className="size-4" />{pending ? "Saving…" : label}</button></div>; }

function CompanyProfile({ company, setCompany, disabled }: { company: CompanySettingsDto; setCompany: React.Dispatch<React.SetStateAction<CompanySettingsDto>>; disabled: boolean }) {
  const set = (key: keyof CompanySettingsDto, value: string) => setCompany(current => ({ ...current, [key]: value }));
  return <><Heading title="Company profile" description="Business identity and regional preferences used across this workspace." /><div className="grid gap-5 sm:grid-cols-2"><Field label="Company name" value={company.name} onChange={value => set("name", value)} disabled={disabled} /><Field label="Business email" type="email" value={company.businessEmail} onChange={value => set("businessEmail", value)} disabled={disabled} /><Field label="Phone" value={company.phone} onChange={value => set("phone", value)} disabled={disabled} /><Field label="City" value={company.city} onChange={value => set("city", value)} disabled={disabled} /><div className="sm:col-span-2"><Field label="Office address" value={company.address} onChange={value => set("address", value)} disabled={disabled} /></div><label><span className="label">Timezone</span><select aria-label="Company timezone" className="input disabled:bg-slate-100" value={company.timezone} disabled={disabled} onChange={event => set("timezone", event.target.value)}>{supportedTimezones.map(zone => <option key={zone}>{zone}</option>)}</select></label><label><span className="label">Currency</span><select aria-label="Company currency" className="input disabled:bg-slate-100" value="PKR" disabled><option>PKR</option></select></label></div></>;
}

function CatalogSettings({ company, setCompany, disabled }: { company: CompanySettingsDto; setCompany: React.Dispatch<React.SetStateAction<CompanySettingsDto>>; disabled: boolean }) {
  return <><Heading title="Services and lead sources" description="Disable existing values safely or add tenant-specific options. Values already used by leads cannot be deleted." /><div className="grid gap-6 xl:grid-cols-2"><Catalog title="Services" items={company.services} disabledItems={company.disabledServices} disabled={disabled} onChange={(items, inactive) => setCompany(current => ({ ...current, services: items, disabledServices: inactive }))} /><Catalog title="Lead sources" items={company.leadSources} disabledItems={company.disabledLeadSources} disabled={disabled} onChange={(items, inactive) => setCompany(current => ({ ...current, leadSources: items, disabledLeadSources: inactive }))} /></div></>;
}
function Catalog({ title, items, disabledItems, disabled, onChange }: { title: string; items: string[]; disabledItems: string[]; disabled: boolean; onChange: (items: string[], inactive: string[]) => void }) {
  const add = () => onChange([...items, `Custom ${title.slice(0, -1)} ${items.length + 1}`], disabledItems);
  return <div><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">{title}</h3>{!disabled && <button className="btn-secondary text-xs" onClick={add}><Plus className="size-3.5" /> Add</button>}</div><div className="space-y-2">{items.map((item, index) => <div key={`${item}-${index}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 p-2"><input aria-label={`${title} item ${index + 1}`} className="input min-w-0 flex-1 border-0 py-1" value={item} disabled={disabled} onChange={event => { const next = [...items]; const old = next[index]; next[index] = event.target.value; onChange(next, disabledItems.map(value => value === old ? event.target.value : value)); }} /><button type="button" aria-label={`${disabledItems.includes(item) ? "Enable" : "Disable"} ${item}`} disabled={disabled} className={`rounded-lg p-2 ${disabledItems.includes(item) ? "text-slate-400" : "text-emerald-600"}`} onClick={() => onChange(items, disabledItems.includes(item) ? disabledItems.filter(value => value !== item) : [...disabledItems, item])}>{disabledItems.includes(item) ? <X className="size-4" /> : <Check className="size-4" />}</button></div>)}</div></div>;
}

function ScoringSettings({ rules, setRules, disabled }: { rules: ScoringRules; setRules: (rules: ScoringRules) => void; disabled: boolean }) {
  const total = Object.values(rules.weights).reduce((sum, item) => sum + item, 0);
  const labels: Record<keyof ScoringRules["weights"], string> = { budget: "Budget fit", timeline: "Start timeline", source: "Lead source", completeness: "Required-field completeness", service: "High-intent service" };
  return <><Heading title="Lead scoring rules" description="Versioned qualification weights for future lead scoring. Existing scores are not recalculated." /><div className="space-y-4">{(Object.keys(labels) as (keyof ScoringRules["weights"])[]).map(key => <label key={key} className="block"><span className="mb-2 flex justify-between text-sm font-bold"><span>{labels[key]}</span><span>{rules.weights[key]}%</span></span><input aria-label={`${labels[key]} weight`} type="number" min="0" max="100" className="input" disabled={disabled} value={rules.weights[key]} onChange={event => setRules({ ...rules, weights: { ...rules.weights, [key]: Number(event.target.value) } })} /></label>)}<p className={`rounded-xl p-3 text-sm font-semibold ${total === 100 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>Total weight: {total}%</p><div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Warm budget threshold</span><input aria-label="Warm budget threshold" type="number" className="input" disabled={disabled} value={rules.budget_thresholds.warm_pkr} onChange={event => setRules({ ...rules, budget_thresholds: { ...rules.budget_thresholds, warm_pkr: Number(event.target.value) } })} /><small>{formatPKR(rules.budget_thresholds.warm_pkr)}</small></label><label><span className="label">Hot budget threshold</span><input aria-label="Hot budget threshold" type="number" className="input" disabled={disabled} value={rules.budget_thresholds.hot_pkr} onChange={event => setRules({ ...rules, budget_thresholds: { ...rules.budget_thresholds, hot_pkr: Number(event.target.value) } })} /><small>{formatPKR(rules.budget_thresholds.hot_pkr)}</small></label></div><p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">Saving rules does not retroactively change lead scores. “Recalculate Scores” belongs to a future scoring stage; AI scoring is not active.</p></div></>;
}

function NotificationSettings({ company, setCompany, preferences, setPreferences, canEditCompany }: { company: CompanySettingsDto; setCompany: React.Dispatch<React.SetStateAction<CompanySettingsDto>>; preferences: NotificationPreferences; setPreferences: React.Dispatch<React.SetStateAction<NotificationPreferences>>; canEditCompany: boolean }) {
  return <><Heading title="In-app notifications" description="Personal preferences override company defaults. Membership security events remain enabled." /><div className="space-y-3">{notificationCategories.map(category => { const required = category === "membership_event"; const personal = preferences[category] ?? company.notificationDefaults[category] ?? true; return <div key={category} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><b className="text-sm">{categoryLabels[category]}</b><p className="text-xs text-slate-500">In-app delivery</p></div><label className="flex items-center gap-2 text-xs"><span>Company</span><input aria-label={`Company ${categoryLabels[category]}`} type="checkbox" className="size-5 accent-blue-600" disabled={!canEditCompany || required} checked={company.notificationDefaults[category] ?? true} onChange={event => setCompany(current => ({ ...current, notificationDefaults: { ...current.notificationDefaults, [category]: event.target.checked } }))} /></label><label className="flex items-center gap-2 text-xs"><span>My preference</span><input aria-label={`My ${categoryLabels[category]}`} type="checkbox" className="size-5 accent-blue-600" disabled={required} checked={personal} onChange={event => setPreferences(current => ({ ...current, [category]: event.target.checked }))} /></label></div>; })}</div><div className="mt-6 grid gap-3 sm:grid-cols-3">{["Email", "WhatsApp", "SMS"].map(channel => <div key={channel} className="rounded-xl bg-slate-50 p-4"><b>{channel}</b><p className="text-xs text-slate-500">Coming later · not active</p></div>)}</div></>;
}

function ProfileSettings({ profile, setProfile }: { profile: SettingsPageData["profile"]; setProfile: React.Dispatch<React.SetStateAction<SettingsPageData["profile"]>> }) { return <><Heading title="My profile" description="Update your own identity preferences. Email and company role remain security-controlled." /><div className="grid gap-5 sm:grid-cols-2"><Field label="Full name" value={profile.fullName} onChange={value => setProfile(current => ({ ...current, fullName: value }))} /><Field label="Email" type="email" value={profile.email} onChange={() => undefined} disabled /><Field label="Profile phone" value={profile.phone} onChange={value => setProfile(current => ({ ...current, phone: value }))} /><label><span className="label">Profile timezone</span><select aria-label="Profile timezone" className="input" value={profile.timezone} onChange={event => setProfile(current => ({ ...current, timezone: event.target.value }))}>{supportedTimezones.map(zone => <option key={zone}>{zone}</option>)}</select></label></div><p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Avatar upload is not implemented. The app continues to display your initials safely.</p></>; }
function Integrations() { return <><Heading title="Integrations" description="External lead-source and delivery integrations remain outside Stage 6." /><div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4"><b>OpenAI lead intelligence</b><span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-700">Use AI settings</span></div><div className="grid gap-4 sm:grid-cols-2">{["WhatsApp", "Facebook Lead Ads", "Email Delivery", "SMS"].map(name => <div key={name} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><b>{name}</b><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500">Coming Soon</span></div>)}</div></>; }

function AISettings({ company, setCompany, disabled }: { company: CompanySettingsDto; setCompany: React.Dispatch<React.SetStateAction<CompanySettingsDto>>; disabled: boolean }) {
  const settings = company.aiSettings;
  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => setCompany(current => ({ ...current, aiSettings: { ...current.aiSettings, [key]: value } }));
  return <><Heading title="AI-assisted lead intelligence" description="Configure advisory analysis and company-side usage controls. The server API key is never entered here." />
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>Human review is mandatory.</b> AI never sends messages or changes lead stage, assignment, score, or temperature automatically.</div>
    <div className="mt-5 space-y-5">
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><input aria-label="Enable AI assistance" type="checkbox" className="mt-0.5 size-5 accent-blue-600" disabled={disabled} checked={settings.enabled} onChange={event => set("enabled", event.target.checked)} /><span><b className="block">Enable AI assistance</b><small className="text-slate-500">Provider configuration must also exist on the server.</small></span></label>
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><input aria-label="Acknowledge AI data minimization" type="checkbox" className="mt-0.5 size-5 accent-blue-600" disabled={disabled} checked={settings.data_minimization_acknowledged} onChange={event => set("data_minimization_acknowledged", event.target.checked)} /><span><b className="block">Data-minimization acknowledgment</b><small className="text-slate-500">Only service, location, property size, budget, timeline, source, stage, temperature, rule score and notes are sent. Name, phone and email are excluded.</small></span></label>
      <div><h3 className="mb-3 font-bold">Allowed roles</h3><div className="grid gap-2 sm:grid-cols-2">{aiAllowedRoles.map(role => <label key={role} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm"><input aria-label={`Allow ${roleLabels[role]}`} type="checkbox" className="size-5 accent-blue-600" disabled={disabled} checked={settings.allowed_roles.includes(role)} onChange={event => set("allowed_roles", event.target.checked ? [...settings.allowed_roles, role] : settings.allowed_roles.filter(item => item !== role))} />{roleLabels[role]}</label>)}</div></div>
      <div className="grid gap-4 sm:grid-cols-2"><NumberField label="Daily company request limit" value={settings.daily_company_limit} disabled={disabled} onChange={value => set("daily_company_limit", value)} /><NumberField label="Monthly company request limit" value={settings.monthly_company_limit} disabled={disabled} onChange={value => set("monthly_company_limit", value)} /><NumberField label="Per-user hourly limit" value={settings.user_hourly_limit} disabled={disabled} onChange={value => set("user_hourly_limit", value)} /><NumberField label="Regeneration cooldown (minutes)" value={settings.regeneration_cooldown_minutes} disabled={disabled} onChange={value => set("regeneration_cooldown_minutes", value)} /><NumberField label="Maximum concurrent generations" value={settings.max_concurrent} disabled={disabled} onChange={value => set("max_concurrent", value)} /></div>
      <label className="flex items-center gap-2 text-sm"><input aria-label="Show AI disclaimer" type="checkbox" className="size-5 accent-blue-600" disabled={disabled} checked={settings.disclaimer_enabled} onChange={event => set("disclaimer_enabled", event.target.checked)} />Show AI disclaimer</label>
      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><b className="text-slate-800">Model:</b> server environment default. Auto-generation on lead creation is off and cannot be enabled in Stage 6.</div>
    </div></>;
}

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) { return <label><span className="label">{label}</span><input aria-label={label} type="number" min="0" className="input" disabled={disabled} value={value} onChange={event => onChange(Number(event.target.value))} /></label>; }
