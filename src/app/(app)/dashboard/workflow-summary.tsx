import Link from "next/link";
import { CalendarCheck2, ClockAlert, MapPinned } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { FollowUpDto, WorkflowMetrics } from "@/types/workflows";

export function WorkflowSummary({ metrics }: {
  metrics: WorkflowMetrics & { dueFollowUps: FollowUpDto[] };
}) {
  return <section className="card p-5">
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">Today&apos;s workflow</h2><p className="text-xs text-slate-500">Live, role-scoped Supabase records</p></div><Link href="/follow-ups" className="text-sm font-bold text-blue-600">View all</Link></div>
    <div className="mt-5 grid grid-cols-3 gap-3">
      <Metric icon={<CalendarCheck2 />} value={metrics.followUpsToday} label="Due today" />
      <Metric icon={<ClockAlert />} value={metrics.overdueFollowUps} label="Overdue" />
      <Metric icon={<MapPinned />} value={metrics.upcomingSiteVisits} label="Site visits" />
    </div>
    <div className="mt-5 divide-y divide-slate-100">
      {!metrics.dueFollowUps.length && <p className="py-5 text-sm text-slate-500">No due follow-ups.</p>}
      {metrics.dueFollowUps.map(item => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><Link href={`/leads/${item.leadId}`} className="block truncate text-sm font-bold hover:text-blue-600">{item.leadName}</Link><p className="text-xs text-slate-500">{item.assignedMemberName}</p></div><span className="shrink-0 text-xs text-slate-500">{formatDate(item.dueAt, true)}</span></div>)}
    </div>
  </section>;
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return <div className="rounded-xl bg-slate-50 p-3 text-center"><span className="mx-auto mb-2 block w-fit text-blue-600 [&>svg]:size-4">{icon}</span><b className="text-xl">{value}</b><p className="text-[10px] text-slate-500">{label}</p></div>;
}
