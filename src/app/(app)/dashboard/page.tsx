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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard title="Total Leads" value={metrics.total} note="Accessible Supabase leads" icon={<Users />} />
      <KpiCard title="Hot Leads" value={metrics.hot} note={`${metrics.warm} warm · ${metrics.cold} cold`} icon={<Flame />} />
      <KpiCard title="Converted Clients" value={metrics.converted} note={`${metrics.conversionRate}% conversion rate`} icon={<CircleCheck />} />
      <KpiCard title="Pipeline Value" value={formatPKR(metrics.activePipeline)} note="Excludes converted and lost" icon={<Wallet />} />
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-3">
      <section className="card p-5 xl:col-span-2"><div className="flex items-center justify-between"><div><h2 className="font-bold">Recent leads</h2><p className="text-xs text-slate-500">Database records in your authorized scope</p></div><Link href="/leads" className="text-sm font-bold text-blue-600">View all</Link></div>
        <div className="mt-4 divide-y divide-slate-100">{report.recent.map(lead => <article key={lead.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><Link href={`/leads/${lead.id}`} className="font-bold hover:text-blue-600">{lead.fullName}</Link><p className="truncate text-xs text-slate-500">{lead.service} · {lead.location} · {formatDate(lead.createdAt)}</p></div><ScoreBadge score={lead.score} /><StatusBadge status={temperatureLabels[lead.temperature]} /><span className="text-xs font-semibold text-slate-500">{stageLabels[lead.stage]}</span></article>)}</div>
      </section>
      <section className="card p-5"><h2 className="font-bold">Lead sources</h2><p className="text-xs text-slate-500">Live accessible lead counts</p><div className="mt-5 space-y-4">{report.sources.slice(0, 6).map(item => <div key={item.name}><div className="mb-1 flex justify-between text-sm"><span>{item.name}</span><b>{item.count}</b></div><ProgressBar value={item.count / sourceMax * 100} /></div>)}</div></section>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="card p-5"><h2 className="font-bold">Conversion funnel</h2><p className="text-xs text-slate-500">Lead-derived stages from Supabase</p><div className="mt-5 space-y-4">{report.stages.map(item => <div key={item.name}><div className="mb-1 flex justify-between text-sm"><span>{stageLabels[item.name as keyof typeof stageLabels] ?? item.name}</span><b>{item.count}</b></div><ProgressBar value={metrics.total ? item.count / metrics.total * 100 : 0} color="bg-emerald-500" /></div>)}</div></section>
      <WorkflowSummary metrics={workflowMetrics} />
    </div>
  </>;
}
