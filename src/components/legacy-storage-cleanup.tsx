"use client";

import { useEffect } from "react";

const retiredKeys = [
  "leadpilot-demo-leads",
  "leadpilot-demo-appointments",
  "leadpilot-demo-completed-followups",
  "leadpilot-demo-scheduled-followups",
];

export function LegacyStorageCleanup() {
  useEffect(() => {
    for (const key of retiredKeys) localStorage.removeItem(key);
  }, []);
  return null;
}
