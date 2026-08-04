import Link from "next/link";
import { CircleCheck, Flame, Users, Wallet } from "lucide-react";
import { getLeadReport } from "@/data-access/services/lead-report-service";
import { getWorkflowMetrics } from "@/data-access/services/follow-up-service";
import { KpiCard, PageHeader, ProgressBar, ScoreBadge, StatusBadge } from "@/components/ui";
import { formatDate, formatPKR } from "@/lib/format";
import { stageLabels, temperatureLabels } from "@/types/leads";
import { WorkflowSummary } from "@/app/(app)/dashboard/workflow-summary";

export default async function DashboardPage() {
  const [report, workflowMetrics] = await Promise.all([
    getLeadReport(),
    getWorkflowMetrics(),
  ]);
  const { metrics } = report;
  const sourceMax = Math.max(...report.sources.map(item => item.count), 1);
  return <>
    <PageHeader title={`Good morning, ${report.auth.fullName.split(" ")[0]}`} description={`Live lead pipeline for ${report.auth.companyName}.`} action={<Link href="/leads/new" className="btn-primary">Add new lead</Link>} />
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard title="Total Leads" value={metrics.total} note="Accessible Supabase leads" icon={<Users />} />
      <KpiCard title="Hot Leads" value={metrics.hot} note={`${metrics.warm} warm · ${metrics.cold} cold`} icon={<Flame />} />
      <KpiCard title="Converted Clients" value={metrics.converted} note={`${metrics.conversionRate}% conversion rate`} icon={<CircleCheck />} />
      <KpiCard title="Pipeline Value" value={formatPKR(metrics.activePipeline)} note="Excludes converted and lost" icon={<Wallet />} />
    </div>
    <div className="mt-5 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-3">
      <section className="card min-w-0 overflow-hidden p-4 sm:p-5 xl:col-span-2"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="font-bold">Recent leads</h2><p className="text-xs leading-relaxed text-slate-500">Latest records in your authorized scope</p></div><Link href="/leads" className="shrink-0 text-sm font-bold text-blue-600">View all</Link></div>
        <div className="mt-3 divide-y divide-slate-100 sm:mt-4">{report.recent.map(lead => <article key={lead.id} className="py-3.5 sm:flex sm:items-center sm:gap-3 sm:py-4"><div className="min-w-0 flex-1"><Link href={`/leads/${lead.id}`} className="block truncate text-sm font-bold hover:text-blue-600 sm:text-base">{lead.fullName}</Link><p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{lead.service} · {lead.location} · {formatDate(lead.createdAt)}</p></div><div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0 sm:flex-nowrap"><ScoreBadge score={lead.score} /><StatusBadge status={temperatureLabels[lead.temperature]} /><span className="text-xs font-semibold text-slate-500">{stageLabels[lead.stage]}</span></div></article>)}</div>
      </section>
      <section className="card min-w-0 overflow-hidden p-4 sm:p-5"><h2 className="font-bold">Lead sources</h2><p className="text-xs text-slate-500">Live accessible lead counts</p><div className="mt-4 space-y-3.5 sm:mt-5 sm:space-y-4">{report.sources.slice(0, 6).map(item => <div key={item.name} className="min-w-0"><div className="mb-1 flex min-w-0 items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate">{item.name}</span><b className="shrink-0 tabular-nums">{item.count}</b></div><ProgressBar value={item.count / sourceMax * 100} /></div>)}</div></section>
    </div>
    <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-2">
      <section className="card min-w-0 overflow-hidden p-4 sm:p-5"><h2 className="font-bold">Conversion funnel</h2><p className="text-xs text-slate-500">Lead-derived pipeline stages</p><div className="mt-4 space-y-3.5 sm:mt-5 sm:space-y-4">{report.stages.map(item => <div key={item.name} className="min-w-0"><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate">{stageLabels[item.name as keyof typeof stageLabels] ?? item.name}</span><b className="shrink-0 tabular-nums">{item.count}</b></div><ProgressBar value={metrics.total ? item.count / metrics.total * 100 : 0} color="bg-emerald-500" /></div>)}</div></section>
      <WorkflowSummary metrics={workflowMetrics} />
    </div>
  </>;
}
