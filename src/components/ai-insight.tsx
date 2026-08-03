"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Check, Clipboard, MessageSquareText, RefreshCw, Sparkles, Target, TriangleAlert } from "lucide-react";
import { applyAIRecommendationAction, generateAIInsightAction } from "@/actions/ai-actions";
import { useToast } from "@/components/toast";
import { formatDate } from "@/lib/format";
import { temperatureLabels, type LeadDto } from "@/types/leads";
import type { AILeadView } from "@/types/ai";

export function AIInsightCard({ lead, initial }: { lead: Pick<LeadDto, "id" | "score" | "temperature">; initial: AILeadView }) {
  const router = useRouter(); const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<"" | "score" | "temperature">("");
  const [copied, setCopied] = useState(false);
  const generate = (force: boolean) => startTransition(async () => {
    const result = await generateAIInsightAction(lead.id, force); toast(result.message);
    if (result.ok || result.state === "failed") router.refresh();
  });
  const apply = () => startTransition(async () => {
    if (!confirm || !initial.insight) return;
    const result = await applyAIRecommendationAction(lead.id, initial.insight.id, confirm, true);
    toast(result.message); setConfirm(""); if (result.ok) router.refresh();
  });
  const copy = async () => {
    if (!initial.insight) return;
    try { await navigator.clipboard.writeText(initial.insight.suggested_reply); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { toast("Suggested reply could not be copied."); }
  };

  return <section className="card h-fit min-w-0 border-blue-100 bg-blue-50/40 p-5" aria-busy={pending}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-lg bg-blue-600 p-2 text-white"><Sparkles className="size-4" /></span><div><h2 className="font-bold text-blue-950">AI Lead Intelligence</h2><p className="text-xs text-blue-700">Assisted recommendation · human review required</p></div></div>{initial.providerMode === "mock" && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase text-amber-800">Mock / test mode</span>}</div>

    {initial.state === "disabled" && <State title="AI assistance is disabled" body="An owner or admin must review data minimization and enable AI for this company.">{["owner", "admin"].includes(initial.auth.role) && <Link className="btn-secondary mt-4" href="/settings">Open AI settings</Link>}</State>}
    {initial.state === "not_configured" && <State title="AI configuration missing" body="Company AI may be enabled, but the server provider configuration is unavailable. Lead workflows remain unaffected." />}
    {initial.state === "empty" && <State title="No AI insight generated" body={initial.canGenerate ? "Generate a structured recommendation from minimized lead data." : "Your role is not enabled for company AI assistance."}>{initial.canGenerate && <button disabled={pending} className="btn-primary mt-4" onClick={() => generate(false)}><Sparkles className="size-4" />{pending ? "Generating…" : "Generate Insight"}</button>}</State>}
    {initial.state === "generating" && <State title="Generating insight" body="One trusted server request is in progress. Refreshing will not create another provider call."><span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700"><RefreshCw className="size-4 animate-spin" /> Please wait</span></State>}
    {initial.state === "failed" && !initial.insight && <State title="Insight generation failed" body="The optional AI request failed safely; no lead fields were changed.">{initial.canGenerate && <button disabled={pending} className="btn-secondary mt-4" onClick={() => generate(false)}><RefreshCw className="size-4" /> Retry</button>}</State>}

    {initial.insight && <div className="mt-5 space-y-4">
      {initial.state === "stale" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>Insight is stale.</b> AI-relevant lead data changed after generation. Review the old version or regenerate it.</div>}
      <Insight icon={<BrainCircuit />} title="Summary">{initial.insight.summary}</Insight>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <Metric label="Buying intent" value={initial.insight.buying_intent} />
        <Metric label="Confidence" value={`${Math.round(initial.insight.confidence * 100)}%`} />
        <Metric label="Official rule score" value={String(lead.score)} />
        <Metric label="AI recommended score" value={String(initial.insight.recommended_score)} />
        <Metric label="Current temperature" value={temperatureLabels[lead.temperature]} />
        <Metric label="AI recommendation" value={temperatureLabels[initial.insight.recommended_temperature]} />
      </div>
      <List title="Score factors" values={initial.insight.score_factors} />
      <List title="Missing information" values={initial.insight.missing_information} empty="No obvious missing qualification fields." />
      <List title="Risk flags" values={initial.insight.risk_flags} empty="No specific risk flags from supplied data." />
      <Insight icon={<Target />} title="Recommended next action">{initial.insight.recommended_next_action}</Insight>
      <div className="rounded-xl bg-white p-4 ring-1 ring-blue-100"><div className="flex items-center justify-between gap-3"><h3 className="text-xs font-extrabold uppercase tracking-wide text-blue-900">Suggested reply</h3><button className="rounded-lg p-2 text-blue-700 hover:bg-blue-50" aria-label="Copy suggested reply" onClick={copy}>{copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}</button></div><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{initial.insight.suggested_reply}</p><p className="mt-3 text-xs font-semibold text-amber-700">Review before sending. AI-generated content may contain mistakes.</p></div>
      <p className="text-[11px] text-slate-500">Generated {formatDate(initial.insight.generatedAt, true)} · {initial.insight.model} · prompt {initial.insight.promptVersion}</p>
      <div className="flex flex-wrap gap-2"><button disabled={pending || !initial.canGenerate} className="btn-secondary" onClick={() => generate(true)}><RefreshCw className="size-4" /> Regenerate</button><button disabled={pending || initial.state === "stale" || lead.score === initial.insight.recommended_score} className="btn-secondary" onClick={() => setConfirm("score")}>Apply Score Recommendation</button><button disabled={pending || initial.state === "stale" || lead.temperature === initial.insight.recommended_temperature} className="btn-secondary" onClick={() => setConfirm("temperature")}>Apply Temperature Recommendation</button></div>
      {confirm && <div role="alertdialog" aria-label="Confirm AI recommendation" className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-2"><TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" /><div><b>Apply this AI recommendation?</b><p className="mt-1 text-xs text-amber-900">This manual action will update only the lead {confirm} and add an audit activity. Stage and assignment will not change.</p></div></div><div className="mt-4 flex gap-2"><button disabled={pending} className="btn-primary" onClick={apply}>Confirm apply</button><button disabled={pending} className="btn-secondary" onClick={() => setConfirm("")}>Cancel</button></div></div>}
      <p className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600">AI output is advisory and may be incorrect. A salesperson must verify facts and approve every change or message.</p>
    </div>}
  </section>;
}

function State({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) { return <div className="mt-5 rounded-xl bg-white p-5 text-center ring-1 ring-blue-100"><MessageSquareText className="mx-auto size-6 text-blue-500" /><h3 className="mt-3 font-bold">{title}</h3><p className="mt-1 text-sm text-slate-600">{body}</p>{children}</div>; }
function Insight({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <div className="flex gap-3"><span className="mt-0.5 text-blue-600 [&>svg]:size-4">{icon}</span><div className="min-w-0"><h3 className="text-xs font-extrabold uppercase tracking-wide text-blue-900">{title}</h3><p className="mt-1 break-words text-sm leading-relaxed text-slate-600">{children}</p></div></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white p-3 ring-1 ring-blue-100"><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><p className="mt-1 capitalize font-extrabold text-slate-800">{value}</p></div>; }
function List({ title, values, empty = "None identified." }: { title: string; values: string[]; empty?: string }) { return <div><h3 className="text-xs font-extrabold uppercase tracking-wide text-blue-900">{title}</h3>{values.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{values.map(value => <li key={value}>{value}</li>)}</ul> : <p className="mt-1 text-sm text-slate-500">{empty}</p>}</div>; }
