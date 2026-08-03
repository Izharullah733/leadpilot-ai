import Link from "next/link";
import { ArrowUpDown, Eye, Plus, Search, X } from "lucide-react";
import { getLeadList } from "@/data-access/services/lead-service";
import { formatDate, formatPKR } from "@/lib/format";
import { PageHeader, ScoreBadge, StatusBadge } from "@/components/ui";
import {
  stageLabels,
  temperatureLabels,
  type LeadStage,
  type LeadTemperature,
} from "@/types/leads";
import { sources } from "@/lib/constants";

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(first(params.page)) || 1);
  const input = {
    search: first(params.search)?.slice(0, 100),
    temperature: first(params.temperature) as LeadTemperature | undefined,
    source: first(params.source)?.slice(0, 100),
    assignedMemberId: first(params.assignedMemberId),
    stage: first(params.stage) as LeadStage | undefined,
    sort: (first(params.sort) as "score" | "date" | "budget") ?? "score",
    page,
    pageSize: 10,
  };
  const { result, members } = await getLeadList(input);
  const activeFilters = [
    input.search,
    input.temperature,
    input.source,
    input.assignedMemberId,
    input.stage,
  ].filter(Boolean).length;

  function pageHref(nextPage: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
      if (key !== "pageSize" && value) query.set(key, String(value));
    }
    query.set("page", String(nextPage));
    return `/leads?${query}`;
  }

  return <>
    <PageHeader
      title="Leads"
      description="Tenant-secured opportunities loaded from Supabase."
      action={<Link href="/leads/new" className="btn-primary"><Plus className="size-4" /> Add lead</Link>}
    />
    <form method="get" className="card mb-5 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_repeat(5,minmax(0,1fr))_auto]">
        <label className="relative">
          <span className="sr-only">Search leads</span>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input name="search" aria-label="Search leads" placeholder="Search name, phone, location or service..." defaultValue={input.search} className="input pl-9" />
        </label>
        <select name="temperature" aria-label="Filter by status" className="input" defaultValue={input.temperature ?? ""}><option value="">All statuses</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option></select>
        <select name="source" aria-label="Filter by source" className="input" defaultValue={input.source ?? ""}><option value="">All sources</option>{sources.map(source => <option key={source}>{source}</option>)}</select>
        <select name="assignedMemberId" aria-label="Filter by salesperson" className="input" defaultValue={input.assignedMemberId ?? ""}><option value="">All salespeople</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
        <select name="stage" aria-label="Filter by stage" className="input" defaultValue={input.stage ?? ""}><option value="">All stages</option>{Object.entries(stageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select name="sort" aria-label="Sort leads" className="input" defaultValue={input.sort}><option value="score">Score: high</option><option value="date">Newest first</option><option value="budget">Budget: high</option></select>
        <button className="btn-primary justify-center">Apply</button>
      </div>
      {activeFilters > 0 && <Link href="/leads" className="btn-secondary mt-3 inline-flex"><X className="size-4" /> Clear filters</Link>}
    </form>
    <section className="card w-0 min-w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <p className="text-sm text-slate-500"><b className="text-slate-900">{result.total}</b> accessible leads</p>
        <span className="hidden items-center gap-1 text-xs text-slate-400 sm:flex"><ArrowUpDown className="size-3.5" /> Server sorted by {input.sort}</span>
      </div>
      {!result.leads.length ? <div className="p-12 text-center"><h2 className="font-bold">No leads found</h2><p className="mt-1 text-sm text-slate-500">Try changing the search or filters.</p></div> : <>
        <div className="divide-y divide-slate-100 lg:hidden">
          {result.leads.map(lead => <article key={lead.id} className="p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/leads/${lead.id}`} className="block break-words font-bold hover:text-blue-600">{lead.fullName}</Link><p className="mt-1 break-words text-xs text-slate-500">{lead.phone} · {lead.location}</p></div><ScoreBadge score={lead.score} /></div>
            <p className="mt-3 break-words text-sm font-medium">{lead.service}</p>
            <div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={temperatureLabels[lead.temperature]} /><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{stageLabels[lead.stage]}</span></div>
            <div className="mt-4 flex items-end justify-between text-xs text-slate-500"><div><b className="block text-sm text-slate-800">{formatPKR(lead.budget)}</b><span>Created {formatDate(lead.createdAt)}</span></div><Link aria-label={`View ${lead.fullName}`} href={`/leads/${lead.id}`} className="p-2 text-blue-600"><Eye className="size-4" /></Link></div>
          </article>)}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="desktop-table w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Lead</th><th className="px-5 py-3">Requirement</th><th className="px-5 py-3">Budget</th><th className="px-5 py-3">Score</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Stage</th><th className="px-5 py-3">Assigned</th><th className="px-5 py-3">Created</th><th><span className="sr-only">Action</span></th></tr></thead>
            <tbody className="divide-y divide-slate-100">{result.leads.map(lead => <tr key={lead.id}><td className="px-5 py-4"><Link href={`/leads/${lead.id}`} className="font-bold hover:text-blue-600">{lead.fullName}</Link><small className="block text-slate-500">{lead.leadNumber} · {lead.phone}</small></td><td className="px-5 py-4"><span className="block max-w-48 truncate">{lead.service}</span><small>{lead.location}</small></td><td className="whitespace-nowrap px-5 py-4 font-semibold">{formatPKR(lead.budget)}</td><td className="px-5 py-4"><ScoreBadge score={lead.score} /></td><td className="px-5 py-4"><StatusBadge status={temperatureLabels[lead.temperature]} /></td><td className="whitespace-nowrap px-5 py-4">{stageLabels[lead.stage]}</td><td className="whitespace-nowrap px-5 py-4">{lead.salesperson}</td><td className="whitespace-nowrap px-5 py-4">{formatDate(lead.createdAt)}</td><td className="px-5 py-4"><Link aria-label={`View ${lead.fullName}`} href={`/leads/${lead.id}`} className="p-2 text-blue-600"><Eye className="size-4" /></Link></td></tr>)}</tbody>
          </table>
        </div>
      </>}
      <div className="flex items-center justify-between border-t border-slate-100 p-4">
        <span className="text-xs text-slate-500">Page {result.page} of {result.pageCount}</span>
        <div className="flex gap-2">
          {result.page > 1 ? <Link className="btn-secondary text-xs" href={pageHref(result.page - 1)}>Previous</Link> : <span className="btn-secondary cursor-not-allowed text-xs opacity-50">Previous</span>}
          {result.page < result.pageCount ? <Link className="btn-secondary text-xs" href={pageHref(result.page + 1)}>Next</Link> : <span className="btn-secondary cursor-not-allowed text-xs opacity-50">Next</span>}
        </div>
      </div>
    </section>
  </>;
}
