import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { LegacyStorageCleanup } from "@/components/legacy-storage-cleanup";

export const metadata: Metadata = {
  title: { default: "LeadPilot AI", template: "%s | LeadPilot AI" },
  description: "AI-powered lead management for construction and real-estate companies.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LegacyStorageCleanup /><ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
