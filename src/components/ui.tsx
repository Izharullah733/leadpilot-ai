import type { LeadStatus } from "@/types";
import { Search, Inbox, TrendingUp, TrendingDown } from "lucide-react";

export function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div>
      {action}
    </div>
  );
}

const statusStyles: Record<LeadStatus, string> = {
  Hot: "bg-rose-50 text-rose-700 ring-rose-600/10",
  Warm: "bg-amber-50 text-amber-700 ring-amber-600/10",
  Cold: "bg-slate-100 text-slate-600 ring-slate-500/10",
};
export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${statusStyles[status]}`}>{status}</span>;
}
export function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-700 bg-emerald-50" : score >= 60 ? "text-amber-700 bg-amber-50" : "text-slate-600 bg-slate-100";
  return <span className={`inline-flex min-w-11 justify-center rounded-lg px-2 py-1 text-xs font-extrabold ${color}`}>{score}</span>;
}

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input {...props} className={`input pl-9 ${props.className ?? ""}`} /></div>;
}

export function EmptyState({ onClear }: { onClear?: () => void }) {
  return <div className="flex flex-col items-center px-6 py-16 text-center"><span className="mb-4 rounded-full bg-slate-100 p-4"><Inbox className="size-7 text-slate-400" /></span><h3 className="font-bold text-slate-900">No leads found</h3><p className="mt-1 text-sm text-slate-500">Try changing your search or filter selection.</p>{onClear && <button className="btn-secondary mt-5" onClick={onClear}>Clear filters</button>}</div>;
}

export function KpiCard({ title, value, note, icon, trend }: { title: string; value: string | number; note: string; icon: React.ReactNode; trend?: "up" | "down" }) {
  return <div className="card p-5"><div className="flex items-start justify-between"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">{icon}</div>{trend && <span className={`flex items-center gap-1 text-xs font-bold ${trend === "up" ? "text-emerald-600" : "text-rose-600"}`}>{trend === "up" ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}{note}</span>}</div><p className="mt-4 text-sm font-medium text-slate-500">{title}</p><p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>{!trend && <p className="mt-1 text-xs text-slate-400">{note}</p>}</div>;
}

export function ProgressBar({ value, color = "bg-blue-600" }: { value: number; color?: string }) {
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} /></div>;
}

export function FormField({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}{required && <span aria-hidden="true" className="text-rose-500"> *</span>}</span>{children}{error && <span role="alert" className="mt-1.5 block text-xs font-medium text-rose-600">{error}</span>}</label>;
}

export function LoadingState() {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>;
}
