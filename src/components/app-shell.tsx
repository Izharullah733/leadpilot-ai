"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, UsersRound, ClipboardList, CalendarDays, BarChart3, Settings, LogOut, Menu, X, Search, Building2, ChevronDown } from "lucide-react";
import { AuthProvider } from "@/context/auth-context";
import { getInitials, roleLabels, type AuthContext } from "@/lib/auth";
import { selectCompany } from "@/actions/tenant-actions";
import { NotificationMenu } from "@/components/notification-menu";
import type { NotificationCenterData } from "@/types/settings";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: UsersRound },
  { label: "Follow-ups", href: "/follow-ups", icon: ClipboardList },
  { label: "Appointments", href: "/appointments", icon: CalendarDays },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Team", href: "/team", icon: UsersRound },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({
  auth,
  notificationCenter,
  children,
}: {
  auth: AuthContext;
  notificationCenter: NotificationCenterData;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const initials = getInitials(auth.fullName);
  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-[#0b1830] px-3 text-white">
      <Link href="/dashboard" className="flex items-center gap-3 px-3 py-6" onClick={() => setOpen(false)}>
        <span className="rounded-xl bg-blue-600 p-2"><Building2 className="size-5" /></span>
        <span><b className="block text-lg leading-tight">LeadPilot AI</b><small className="text-[10px] text-slate-400">SMARTER SALES</small></span>
      </Link>
      <nav aria-label="Main navigation" className="flex-1 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href === "/leads" && pathname.startsWith("/leads/"));
          return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}><item.icon className="size-[18px]" />{item.label}</Link>;
        })}
      </nav>
      <form action="/auth/logout" method="post">
        <button type="submit" className="mb-4 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white"><LogOut className="size-[18px]" /> Logout</button>
      </form>
      <div className="mb-4 rounded-xl bg-white/5 p-3 text-xs text-slate-400">
        {auth.tenants.length > 1 ? <form action={selectCompany}>
          <input type="hidden" name="next" value={pathname} />
          <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide">Workspace</span>
            <select name="companyId" defaultValue={auth.companyId} onChange={event => event.currentTarget.form?.requestSubmit()} className="w-full rounded-lg border border-white/10 bg-[#142746] px-2 py-2 text-xs font-semibold text-white">
              {auth.tenants.map(tenant => <option key={tenant.companyId} value={tenant.companyId}>{tenant.companyName}</option>)}
            </select>
          </label>
        </form> : <p className="font-bold text-slate-200">{auth.companyName}</p>}
        <p className="mt-1 leading-relaxed">Authenticated workspace · Phase 2A</p>
      </div>
    </aside>
  );
  return (
    <div className="min-h-screen">
      <div className="fixed inset-y-0 left-0 hidden md:block">{sidebar}</div>
      {open && <div className="fixed inset-0 z-50 md:hidden"><button aria-label="Close menu" className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)} /><div className="relative h-full w-64">{sidebar}<button aria-label="Close menu" className="absolute right-3 top-5 text-white" onClick={() => setOpen(false)}><X /></button></div></div>}
      <div className="min-w-0 md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:h-18 sm:px-6">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"><Menu className="size-5" /></button>
          <form className="relative hidden max-w-md flex-1 lg:block" onSubmit={event => { event.preventDefault(); const query=globalSearch.trim(); if(query) router.push(`/leads?search=${encodeURIComponent(query)}`); }}><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input aria-label="Global lead search" value={globalSearch} onChange={event=>setGlobalSearch(event.target.value)} placeholder="Search leads..." className="input bg-slate-50 pl-9" /></form>
          <div className="ml-auto flex items-center gap-2">
            <NotificationMenu initial={notificationCenter} />
            <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-3"><span className="grid size-9 place-items-center rounded-full bg-blue-100 text-sm font-extrabold text-blue-700">{initials}</span><span className="hidden text-left sm:block"><b className="block text-sm text-slate-800">{auth.fullName}</b><small className="text-slate-500">{roleLabels[auth.role]}</small></span><ChevronDown className="hidden size-4 text-slate-400 sm:block" /></div>
          </div>
        </header>
        <main className="min-w-0 max-w-full overflow-x-hidden px-3 py-4 sm:p-6 lg:p-8"><AuthProvider value={auth}>{children}</AuthProvider></main>
      </div>
    </div>
  );
}
