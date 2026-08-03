import { CircleCheck, Target, UserRound, Wallet } from "lucide-react";
import Link from "next/link";
import { getLeadReport } from "@/data-access/services/lead-report-service";
import { formatPKR } from "@/lib/format";
import { KpiCard, PageHeader, ProgressBar } from "@/components/ui";
import { stageLabels, temperatureLabels } from "@/types/leads";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const start = first(params.start) ?? "";
  const end = first(params.end) ?? "";
  const report = await getLeadReport({ start, end });
  return <>
    <PageHeader title="Reports" description="Server-calculated lead performance for the selected tenant and authorized scope." />
    <form method="get" className="card mb-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
      <label><span className="label">Start date</span><input name="start" type="date" className="input" defaultValue={start} /></label>
      <label><span className="label">End date</span><input name="end" type="date" className="input" defaultValue={end} /></label>
      <button className="btn-primary justify-center">Apply date range</button>
      {(start || end) && <Link href="/reports" className="btn-secondary justify-center">Clear dates</Link>}
    </form>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard title="Total leads" value={report.metrics.total} note="Supabase records" icon={<Target />} />
      <KpiCard title="Conversion rate" value={`${report.metrics.conversionRate}%`} note={`${report.metrics.converted} converted`} icon={<CircleCheck />} />
      <KpiCard title="Active pipeline value" value={formatPKR(report.metrics.activePipeline)} note="Excludes converted and lost" icon={<Wallet />} />
      <KpiCard title="Top performer" value={report.topPerformer} note="Conversions, score, then name" icon={<UserRound />} />
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <Chart title="Leads by source" data={report.sources} />
      <Chart title="Leads by service" data={report.services} />
      <Chart title="Leads by status" data={report.statuses.map(item => ({ ...item, name: temperatureLabels[item.name as keyof typeof temperatureLabels] ?? item.name }))} />
      <Chart title="Pipeline stages" data={report.stages.map(item => ({ ...item, name: stageLabels[item.name as keyof typeof stageLabels] ?? item.name }))} />
      <Chart title="Monthly lead trend" data={report.monthly.map(item => ({ name: item.month, count: item.count }))} />
    </div>
    <section className="card mt-6 overflow-hidden">
      <div className="p-5"><h2 className="font-bold">Salesperson performance</h2><p className="text-xs text-slate-500">Live lead assignments in this report scope</p></div>
      <div className="divide-y divide-slate-100 lg:hidden">{report.performance.map(person => <article key={person.memberId} className="p-5"><b>{person.name}</b><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><p><span className="block text-xs text-slate-500">Assigned</span><b>{person.assigned}</b></p><p><span className="block text-xs text-slate-500">Converted</span><b>{person.conversions}</b></p><p><span className="block text-xs text-slate-500">Pipeline</span><b>{formatPKR(person.pipeline)}</b></p><p><span className="block text-xs text-slate-500">Average score</span><b>{person.averageScore}</b></p></div></article>)}</div>
      <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Salesperson</th><th className="px-5 py-3">Assigned leads</th><th className="px-5 py-3">Converted</th><th className="px-5 py-3">Active pipeline</th><th className="px-5 py-3">Average score</th></tr></thead><tbody className="divide-y divide-slate-100">{report.performance.map(person => <tr key={person.memberId}><td className="px-5 py-4 font-bold">{person.name}</td><td className="px-5 py-4">{person.assigned}</td><td className="px-5 py-4">{person.conversions}</td><td className="px-5 py-4">{formatPKR(person.pipeline)}</td><td className="px-5 py-4">{person.averageScore}</td></tr>)}</tbody></table></div>
    </section>
  </>;
}

function Chart({ title, data }: { title: string; data: { name: string; count: number }[] }) {
  const max = Math.max(...data.map(item => item.count), 1);
  return <section className="card p-5"><h2 className="font-bold">{title}</h2>{data.length ? <div className="mt-5 space-y-4">{data.slice(0, 10).map(item => <div key={item.name}><div className="mb-1 flex justify-between text-sm"><span className="truncate pr-3">{item.name}</span><b>{item.count}</b></div><ProgressBar value={item.count / max * 100} /></div>)}</div> : <p className="py-10 text-center text-sm text-slate-500">No leads in this range.</p>}</section>;
}
