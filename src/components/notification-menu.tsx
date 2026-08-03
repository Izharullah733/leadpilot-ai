"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/actions/notification-actions";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/toast";
import type { NotificationCenterData } from "@/types/settings";

export function NotificationMenu({ initial }: { initial: NotificationCenterData }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [notifications, setNotifications] = useState(initial.notifications);
  const root = useRef<HTMLDivElement>(null);
  const unread = notifications.filter(item => !item.readAt).length;
  useEffect(() => {
    setNotifications(initial.notifications);
    setOpen(false);
  }, [initial]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const click = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", key); document.addEventListener("mousedown", click);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", click); };
  }, []);
  const read = (id: string) => startTransition(async () => {
    const result = await markNotificationReadAction(id);
    if (result.ok) setNotifications(items => items.map(item => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    else toast(result.message);
  });
  const readAll = () => startTransition(async () => {
    const result = await markAllNotificationsReadAction();
    if (result.ok) setNotifications(items => items.map(item => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    else toast(result.message);
  });
  return <div className="relative" ref={root}>
    <button type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"><Bell className="size-5" />{unread > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>}</button>
    {open && <div role="dialog" aria-label="Recent notifications" aria-busy={pending} className="card absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 p-4"><div><p className="font-bold">Notifications</p><p className="text-xs text-slate-500">{unread} unread</p></div><button disabled={pending || unread === 0} className="rounded-lg p-2 text-blue-600 disabled:text-slate-300" aria-label="Mark all notifications read" onClick={readAll}><CheckCheck className="size-5" /></button></div>
      <div className="max-h-[26rem] overflow-y-auto">
        {!notifications.length && <div className="p-8 text-center"><p className="font-semibold">No notifications</p><p className="mt-1 text-xs text-slate-500">New in-app events will appear here.</p></div>}
        {notifications.map(item => <article key={item.id} className={`border-b border-slate-100 p-4 last:border-0 ${item.readAt ? "bg-white" : "bg-blue-50/60"}`}><div className="flex items-start gap-3"><button disabled={pending || !!item.readAt} aria-label={`Mark ${item.title} read`} onClick={() => read(item.id)} className={`mt-1 size-2.5 shrink-0 rounded-full ${item.readAt ? "bg-slate-200" : "bg-blue-600"}`} /><div className="min-w-0 flex-1">{item.href ? <Link href={item.href} onClick={() => { read(item.id); setOpen(false); }} className="font-bold hover:text-blue-600">{item.title}</Link> : <b>{item.title}</b>}<p className="mt-1 break-words text-xs text-slate-600">{item.body}</p><time className="mt-2 block text-[10px] text-slate-400">{formatDate(item.createdAt, true)}</time></div></div></article>)}
      </div>
    </div>}
  </div>;
}
