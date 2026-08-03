"use client";

import { CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const showToast = useCallback((next: string) => {
    setMessage(next);
    window.setTimeout(() => setMessage(""), 3500);
  }, []);
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {message && (
        <div role="status" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl bg-[#10213f] px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <CheckCircle2 className="size-5 text-emerald-400" /> {message}
          <button aria-label="Dismiss notification" onClick={() => setMessage("")}><X className="size-4" /></button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
