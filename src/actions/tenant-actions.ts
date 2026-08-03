"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSafeInternalRedirect } from "@/lib/auth";
import { COMPANY_COOKIE, resolveTenantContext } from "@/services/tenant-service";

export async function selectCompany(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const next = getSafeInternalRedirect(String(formData.get("next") ?? ""));
  const resolution = await resolveTenantContext();
  if (
    resolution.state !== "active" ||
    !resolution.auth.tenants.some(tenant => tenant.companyId === companyId)
  ) redirect("/dashboard");

  (await cookies()).set(COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(next);
}
