// Server Component — no "use client" directive
// Reads cookies on the server to determine the correct initial tab and admin role,
// then passes them as props to the client component. This eliminates the flash of
// the dashboard skeleton that appeared when navigating to any non-REGISTRY tab and refreshing.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/app/actions";
import AdminDashboardClient from "@/app/AdminDashboardClient";

type NavTab = "STATEMENTS" | "PAYMENTS" | "ACCOUNTS" | "SMS_CENTER" | "AUDIT_LOGS" | "RATEPAYERS" | "REGISTRY" | "PAID_USERS" | "FEE_PAYMENTS" | "SETTINGS";

const VALID_TABS: NavTab[] = ["STATEMENTS", "PAYMENTS", "ACCOUNTS", "SMS_CENTER", "AUDIT_LOGS", "RATEPAYERS", "REGISTRY", "PAID_USERS", "FEE_PAYMENTS", "SETTINGS"];
const OFFICER_ALLOWED_TABS: NavTab[] = ["STATEMENTS", "PAYMENTS"];

import { OfficerStatementView } from "@/components/OfficerStatementView";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Verify the session server-side (uses memory cache, so this is fast)
  const admin = await verifyAdminSession();
  if (!admin) {
    redirect("/login");
  }

  const isOfficer = admin.role === "OFFICER";

  const resolvedParams = searchParams ? await searchParams : {};
  const accountParam = resolvedParams.account || resolvedParams.accountNumber || resolvedParams.accountNo;
  const initialAccountNo = typeof accountParam === "string" ? accountParam.trim() : undefined;

  // Server-side code split: Field officers only render the focused statement engine
  if (isOfficer) {
    const cookieStore = await cookies();
    const sectionCookie = cookieStore.get("kkma_officer_active_section")?.value;
    const accountCookie = cookieStore.get("kkma_officer_statement_account")?.value;
    const sectionParam = typeof resolvedParams.section === "string" 
      ? resolvedParams.section 
      : typeof resolvedParams.tab === "string" 
      ? resolvedParams.tab 
      : undefined;
    
    const initialSection: "STATEMENT" | "PAYMENTS" =
      (sectionParam && sectionParam.toLowerCase() === "payments") || sectionCookie === "PAYMENTS"
        ? "PAYMENTS"
        : "STATEMENT";

    const effectiveAccountNo = initialAccountNo || (accountCookie && accountCookie.trim() ? accountCookie.trim() : undefined);

    return (
      <OfficerStatementView
        initialAdmin={{ id: admin.id, username: admin.username, name: admin.name, role: admin.role }}
        initialAccountNo={effectiveAccountNo}
        initialSection={initialSection}
      />
    );
  }

  // Read the tab param or cookie written by handleTabChange on the client
  const cookieStore = await cookies();
  const tabCookie = cookieStore.get("admin_active_tab")?.value as NavTab | undefined;
  const tabParam = typeof resolvedParams.tab === "string" ? resolvedParams.tab.toUpperCase() : undefined;
  const initialTab: NavTab =
    tabParam && VALID_TABS.includes(tabParam as NavTab)
      ? (tabParam as NavTab)
      : tabCookie && VALID_TABS.includes(tabCookie)
      ? tabCookie
      : "STATEMENTS";

  return (
    <AdminDashboardClient
      initialTab={initialTab}
      initialAdmin={{ id: admin.id, username: admin.username, name: admin.name, role: admin.role }}
      initialAccountNo={initialAccountNo}
    />
  );
}
