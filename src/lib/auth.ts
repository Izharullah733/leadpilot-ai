import type { Database } from "@/types/database";

export const protectedRoutePrefixes = [
  "/dashboard",
  "/leads",
  "/follow-ups",
  "/appointments",
  "/reports",
  "/team",
  "/settings",
  "/account-access",
] as const;

export type MemberRole = Database["public"]["Enums"]["member_role"];
export type MembershipStatus = Database["public"]["Enums"]["membership_status"];

export type AuthContext = {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  memberId: string;
  companyId: string;
  companyName: string;
  role: MemberRole;
  tenants: TenantOption[];
};

export type TenantOption = {
  companyId: string;
  companyName: string;
  memberId: string;
  role: MemberRole;
};

export const roleLabels: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  sales_manager: "Sales Manager",
  sales_representative: "Sales Representative",
};

export function isProtectedPath(pathname: string) {
  return protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getSafeInternalRedirect(
  requestedPath: string | null | undefined,
  fallback = "/dashboard",
) {
  if (
    !requestedPath ||
    !requestedPath.startsWith("/") ||
    requestedPath.startsWith("//") ||
    requestedPath.includes("\\")
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(requestedPath, "https://leadpilot.internal");
    if (
      parsed.origin !== "https://leadpilot.internal" ||
      !isProtectedPath(parsed.pathname) &&
      parsed.pathname !== "/invitations/accept"
    ) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}

export function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LP";
}
