import { LeadDetailClient } from "@/app/(app)/leads/[id]/lead-detail-client";
import { getLeadDetail } from "@/data-access/services/lead-service";
import Link from "next/link";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getLeadDetail(id);
  if (!detail) {
    return <div className="card mx-auto max-w-lg p-10 text-center"><h1 className="text-2xl font-bold">Lead not found</h1><p className="mt-2 text-slate-500">This lead does not exist, is archived, or is outside your permitted scope.</p><Link href="/leads" className="btn-primary mt-6">Return to leads</Link></div>;
  }
  return <LeadDetailClient {...detail} />;
}
