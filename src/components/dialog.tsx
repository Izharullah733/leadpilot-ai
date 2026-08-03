"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export function Dialog({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const firstControl = dialog?.querySelector<HTMLElement>("input, select, textarea, button:not([disabled])");
    (firstControl ?? dialog)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center p-4" onKeyDown={event => {
    if (event.key === "Escape") onClose();
    if (event.key === "Tab") {
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>("a, button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") ?? [])];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }}><button tabIndex={-1} aria-label="Close dialog" className="absolute inset-0 bg-slate-950/50" onClick={onClose} /><div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="card relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 id="dialog-title" className="text-lg font-bold">{title}</h2><button type="button" aria-label="Close" className="rounded-lg p-1.5 hover:bg-slate-100" onClick={onClose}><X className="size-5" /></button></div><div className="mt-5">{children}</div></div></div>;
}
